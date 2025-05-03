/**
 * Main sketch file for the p5.js sensory application
 * Manages the canvas, animation loop, and rendering
 */
import { eventBus } from './core/event-bus.js';
import { settingsManager } from './core/app-config.js';
import { stateMachine, AppStates } from './core/state-machine.js';
import { themeManager } from './themes/themeManager.js';

// Debug configuration for sketch.js
const DEBUG = {
    init: true,          // Initialization logs
    draw: false,         // Draw loop logs (high frequency, disabled by default)
    event: true,         // Event handling logs
    performance: true,   // Performance metrics logs
    theme: true,         // Theme-related logs
    audio: true,         // Audio interaction logs
    resize: true,        // Window/canvas resize logs
    error: true          // Error logs
};

// Debug utility functions
function debug(category, ...args) {
    if (DEBUG[category]) {
        console.log(`%c[Sketch:${category}]`, 'color: #ff9966; font-weight: bold', ...args);
    }
}

function logError(category, ...args) {
    if (DEBUG.error) {
        console.error(`%c[Sketch:${category}:ERROR]`, 'color: #ff3860; font-weight: bold', ...args);
    }
}

// Performance monitoring
const performanceMetrics = {
    fps: 0,
    frameTime: 0,
    minFrameTime: Number.MAX_VALUE,
    maxFrameTime: 0,
    avgFrameTime: 0,
    frameCount: 0,
    lastFpsUpdate: 0,
    frameTimeSamples: []
};

// Update performance metrics in a throttled way to avoid performance impact
function updatePerformanceMetrics(frameTime) {
    // New frame time sample
    performanceMetrics.frameTimeSamples.push(frameTime);
    if (performanceMetrics.frameTimeSamples.length > 60) {
        performanceMetrics.frameTimeSamples.shift();
    }
    
    // Calculate metrics
    performanceMetrics.frameCount++;
    performanceMetrics.frameTime = frameTime;
    performanceMetrics.minFrameTime = Math.min(performanceMetrics.minFrameTime, frameTime);
    performanceMetrics.maxFrameTime = Math.max(performanceMetrics.maxFrameTime, frameTime);
    
    // Calculate average
    const sum = performanceMetrics.frameTimeSamples.reduce((a, b) => a + b, 0);
    performanceMetrics.avgFrameTime = sum / performanceMetrics.frameTimeSamples.length;
    
    // Calculate FPS (throttled to once per second to avoid excessive calculations)
    const now = performance.now();
    if (now - performanceMetrics.lastFpsUpdate > 1000) {
        performanceMetrics.fps = Math.round(1000 / performanceMetrics.avgFrameTime);
        performanceMetrics.lastFpsUpdate = now;
        
        // Log performance metrics if enabled
        if (DEBUG.performance) {
            debug('performance', {
                fps: performanceMetrics.fps,
                avgFrameTime: performanceMetrics.avgFrameTime.toFixed(2) + 'ms',
                minFrameTime: performanceMetrics.minFrameTime.toFixed(2) + 'ms',
                maxFrameTime: performanceMetrics.maxFrameTime.toFixed(2) + 'ms'
            });
        }
    }
}

// Global sketch variables
let canvas;
let canvasContainer;
let canvasWidth;
let canvasHeight;
let isRunning = false;
let lastFrameTime = 0;
let frameTimeDelta = 0;
let currentTheme = null;
let audioContextInitialized = false;

/**
 * Initialize p5.js sound with user's audio context
 */
function initializeP5Sound() {
    if (audioContextInitialized) return;
    
    debug('init', 'Initializing p5.js sound with shared audio context');
    
    // Use the globally initialized audio context if available
    if (window._audioContext) {
        try {
            // Set p5.js to use our pre-created audio context
            p5.prototype.getAudioContext = function() {
                return window._audioContext;
            };
            
            debug('init', 'Successfully shared audio context with p5.sound');
            audioContextInitialized = true;
            
            // Listen for audio context events
            eventBus.on('audio-context-ready', (data) => {
                debug('init', 'Audio context ready event received');
                audioContextInitialized = true;
                
                // If theme needs audio, initialize it now
                if (currentTheme && typeof currentTheme.initializeAudio === 'function') {
                    debug('init', 'Initializing theme audio');
                    currentTheme.initializeAudio(data.audioContext);
                }
            });
            
            return true;
        } catch (error) {
            logError('init', 'Failed to initialize p5.sound with shared audio context:', error);
            return false;
        }
    } else {
        debug('init', 'No shared audio context available yet');
        return false;
    }
}

/**
 * p5.js setup function - runs once at the beginning
 */
window.setup = function() {
    debug('init', 'Setting up p5.js sketch');
    
    // Get canvas container dimensions
    canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) {
        logError('init', 'Canvas container element not found!');
        return;
    }
    
    // Create the canvas with appropriate dimensions
    updateCanvasDimensions();
    canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('canvas-container');
    
    debug('init', `Canvas created with dimensions: ${canvasWidth}x${canvasHeight}`);
    
    // Initialize p5.sound if audio context is ready
    initializeP5Sound();
    
    // Initialize the first theme
    initializeTheme();
    
    // Setup resize listener
    window.addEventListener('resize', handleWindowResize);
    debug('init', 'Window resize handler attached');
    
    // Listen for events
    setupEventListeners();
    
    // Setup complete
    debug('init', 'p5.js setup complete');
    eventBus.emit('sketch-initialized');
};

/**
 * Update canvas dimensions based on container size
 */
function updateCanvasDimensions() {
    if (!canvasContainer) return;
    
    const rect = canvasContainer.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    
    debug('resize', `Canvas dimensions updated: ${canvasWidth}x${canvasHeight}`);
}

/**
 * Handle window resize events
 */
function handleWindowResize() {
    debug('resize', 'Window resize detected');
    
    // Update dimensions
    updateCanvasDimensions();
    
    // Resize the canvas
    resizeCanvas(canvasWidth, canvasHeight);
    
    // Notify current theme of resize
    if (currentTheme) {
        debug('resize', 'Notifying theme of canvas resize');
        currentTheme.handleResize(canvasWidth, canvasHeight);
    }
    
    // Emit resize event
    eventBus.emit('canvas-resized', { width: canvasWidth, height: canvasHeight });
}

/**
 * Initialize the active theme
 */
function initializeTheme() {
    try {
        debug('theme', 'Initializing theme');
        
        // Get theme from settings or use default
        const themeName = settingsManager.get('theme.current', 'snowflakes');
        debug('theme', `Loading theme: ${themeName}`);
        
        // Get theme instance from theme manager
        currentTheme = themeManager.getTheme(themeName);
        
        if (!currentTheme) {
            logError('theme', `Failed to load theme: ${themeName}, falling back to snowflakes`);
            currentTheme = themeManager.getTheme('snowflakes');
        }
        
        // Initialize the theme with the canvas dimensions
        currentTheme.initialize(canvasWidth, canvasHeight);
        debug('theme', 'Theme initialized successfully');
        
        // Emit theme changed event
        eventBus.emit('theme-initialized', { themeName });
    } catch (error) {
        logError('theme', 'Error initializing theme:', error);
        eventBus.emit('sketch-error', { 
            type: 'theme-initialization',
            error
        });
    }
}

/**
 * Setup event listeners for communication with other components
 */
function setupEventListeners() {
    debug('event', 'Setting up event listeners');
    
    // Theme change events
    eventBus.on('theme-changed', (data) => {
        debug('theme', `Theme change requested: ${data.themeName}`);
        
        try {
            // Get new theme
            const newTheme = themeManager.getTheme(data.themeName);
            
            if (!newTheme) {
                logError('theme', `Failed to load requested theme: ${data.themeName}`);
                eventBus.emit('theme-change-failed', { themeName: data.themeName });
                return;
            }
            
            // Initialize the new theme
            newTheme.initialize(canvasWidth, canvasHeight);
            
            // Store previous theme for cleanup
            const prevTheme = currentTheme;
            
            // Set new theme
            currentTheme = newTheme;
            debug('theme', `Theme changed to: ${data.themeName}`);
            
            // Clean up previous theme
            if (prevTheme) {
                debug('theme', 'Cleaning up previous theme');
                prevTheme.cleanup();
            }
            
            // Save setting
            settingsManager.set('theme.current', data.themeName);
            
            // Emit theme changed event
            eventBus.emit('theme-changed-complete', { 
                themeName: data.themeName,
                previousTheme: prevTheme ? prevTheme.name : null
            });
        } catch (error) {
            logError('theme', 'Error changing theme:', error);
            eventBus.emit('theme-change-failed', { 
                themeName: data.themeName,
                error
            });
        }
    });
    
    // Sound detection events
    eventBus.on('sound-detected', (intensity) => {
        if (DEBUG.audio) {
            debug('audio', `Sound detected with intensity: ${intensity.toFixed(2)}`);
        }
        
        // Only trigger theme reaction if sketch is running
        if (isRunning && currentTheme) {
            try {
                currentTheme.reactToSound(intensity);
            } catch (error) {
                logError('audio', 'Error in theme sound reaction:', error);
            }
        }
    });
    
    // Application state changes
    eventBus.on('state-changed', (data) => {
        debug('event', `Application state changed: ${data.from} -> ${data.to}`);
        
        // React to state changes
        handleStateChange(data.to, data.from);
    });
    
    // Specific theme settings changes that require theme updates
    eventBus.on('theme-setting-changed', (data) => {
        if (DEBUG.theme) {
            debug('theme', 'Theme setting changed:', data);
        }
        
        if (currentTheme && typeof currentTheme.updateSettings === 'function') {
            try {
                currentTheme.updateSettings(data.setting, data.value);
            } catch (error) {
                logError('theme', 'Error updating theme setting:', error);
            }
        }
    });
}

/**
 * Handle application state changes
 */
function handleStateChange(newState, oldState) {
    debug('event', `Handling state change in sketch: ${oldState} -> ${newState}`);
    
    switch (newState) {
        case AppStates.RUNNING:
            debug('event', 'Starting sketch');
            isRunning = true;
            if (currentTheme) {
                try {
                    currentTheme.start();
                } catch (error) {
                    logError('event', 'Error starting theme:', error);
                }
            }
            break;
            
        case AppStates.PAUSED:
            debug('event', 'Pausing sketch');
            isRunning = false;
            if (currentTheme) {
                try {
                    currentTheme.pause();
                } catch (error) {
                    logError('event', 'Error pausing theme:', error);
                }
            }
            break;
            
        case AppStates.READY:
            if (oldState === AppStates.RUNNING || oldState === AppStates.PAUSED) {
                debug('event', 'Stopping sketch');
                isRunning = false;
                if (currentTheme) {
                    try {
                        currentTheme.stop();
                    } catch (error) {
                        logError('event', 'Error stopping theme:', error);
                    }
                }
            }
            break;
            
        case AppStates.ERROR:
            debug('event', 'Error state entered, stopping sketch');
            isRunning = false;
            if (currentTheme) {
                try {
                    currentTheme.stop();
                } catch (error) {
                    logError('event', 'Error stopping theme after error:', error);
                }
            }
            break;
    }
}

/**
 * p5.js draw function - runs every frame
 */
window.draw = function() {
    // Track frame times for performance monitoring
    const currentTime = performance.now();
    frameTimeDelta = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    
    // Update performance metrics
    updatePerformanceMetrics(frameTimeDelta);
    
    // Extremely throttled draw loop logging to avoid console spam
    if (DEBUG.draw && Math.random() < 0.001) { // Log roughly 0.1% of frames
        debug('draw', `Draw loop (dt: ${frameTimeDelta.toFixed(2)}ms, fps: ${performanceMetrics.fps})`);
    }
    
    // Clear the canvas 
    clear();
    
    // Only draw if running and theme exists
    if (isRunning && currentTheme) {
        try {
            // Update and draw the current theme
            currentTheme.update(frameTimeDelta);
            currentTheme.draw();
        } catch (error) {
            // Handle drawing errors
            logError('draw', 'Error in theme drawing:', error);
            
            // Transition to error state if not already there
            if (!stateMachine.isInState(AppStates.ERROR)) {
                stateMachine.transition(AppStates.ERROR, { error });
            }
            
            // Display error message on canvas
            displayErrorOnCanvas('Error rendering theme', error.message);
        }
    } else if (!isRunning && currentTheme) {
        // For non-running states, just draw a static version
        try {
            currentTheme.drawStatic();
        } catch (error) {
            logError('draw', 'Error in static theme drawing:', error);
            displayErrorOnCanvas('Error rendering static view', error.message);
        }
    }
};

/**
 * Display an error message on the canvas
 */
function displayErrorOnCanvas(title, message) {
    background(25, 0, 0); // Dark red background
    
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text(title, width/2, height/2 - 40);
    
    textSize(16);
    text(message, width/2, height/2);
    
    textSize(14);
    text('Check the console for more details', width/2, height/2 + 40);
}

/**
 * Export functions for external use
 */
export const sketch = {
    // State control
    start: () => {
        debug('event', 'External start requested');
        stateMachine.transition(AppStates.RUNNING);
    },
    
    stop: () => {
        debug('event', 'External stop requested');
        stateMachine.transition(AppStates.READY);
    },
    
    pause: () => {
        debug('event', 'External pause requested');
        stateMachine.transition(AppStates.PAUSED);
    },
    
    // Theme control
    changeTheme: (themeName) => {
        debug('theme', `External theme change requested: ${themeName}`);
        eventBus.emit('theme-changed', { themeName });
    },
    
    // Debug helpers
    getPerformanceMetrics: () => {
        return { ...performanceMetrics };
    },
    
    // Allow setting debug flags at runtime
    setDebugFlag: (category, value) => {
        if (category in DEBUG) {
            debug('event', `Setting debug flag ${category} to ${value}`);
            DEBUG[category] = value;
            return true;
        }
        return false;
    },
    
    // Log all debug categories and their states
    logDebugStatus: () => {
        console.group('%c[Sketch:debug] Debug Categories', 'color: #ff9966; font-weight: bold');
        Object.entries(DEBUG).forEach(([category, enabled]) => {
            console.log(`${category}: ${enabled ? 'enabled' : 'disabled'}`);
        });
        console.groupEnd();
    }
};