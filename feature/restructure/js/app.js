/**
 * Main application entry point
 * Initializes core components and starts the application
 */
import { eventBus } from './core/event-bus.js';
import { settingsManager } from './core/app-config.js';
import { stateMachine, AppStates } from './core/state-machine.js';
import { browserPermissions } from './browser-permissions.js';
import { uiManager } from './ui-manager.js';
import { sketch } from './sketch.js';

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Music Therapy Sensory App initializing...');
    
    // Initialize UI components first
    uiManager.initialize();
    
    // Check for browser audio support without creating an audio context yet
    const audioSupport = browserPermissions.checkAudioSupport();
    if (!audioSupport.fullSupport) {
        console.warn('Limited audio support detected in browser:', audioSupport);
    }
    
    // Check for enhanced privacy modes
    const privacyMode = browserPermissions.detectEnhancedPrivacyMode();
    if (privacyMode.isPrivacyFocused) {
        console.warn('Enhanced privacy mode detected, audio features may be restricted:', privacyMode);
    }
    
    // Set up application-wide error handling
    setupErrorHandling();
    
    // Listen for user interactions to initialize audio context
    initializeAudioOnUserInteraction();
    
    // Listen for button click events
    setupButtonEventListeners();
    
    // Transition to ready state
    stateMachine.transition(AppStates.READY);
});

/**
 * Set up listeners for button click events
 */
function setupButtonEventListeners() {
    console.debug('Setting up button event listeners');
    
    // Start button click handler
    eventBus.on('start-button-clicked', () => {
        console.debug('Start button click event received, starting animation');
        stateMachine.transition(AppStates.RUNNING);
        sketch.start();
    });
    
    // Stop button click handler
    eventBus.on('stop-button-clicked', () => {
        console.debug('Stop button click event received, stopping animation');
        stateMachine.transition(AppStates.READY);
        sketch.stop();
    });
    
    // Enable/disable microphone event handlers
    eventBus.on('enable-microphone', async () => {
        console.debug('Enable microphone event received');
        const result = await browserPermissions.requestMicrophoneAccess();
        if (result.granted) {
            console.debug('Microphone access granted');
            // Additional microphone setup could go here
        }
    });
    
    eventBus.on('disable-microphone', () => {
        console.debug('Disable microphone event received');
        // Add code to disable microphone if needed
    });
}

/**
 * Set up listeners to initialize audio context on first user interaction
 */
function initializeAudioOnUserInteraction() {
    console.debug('Setting up audio initialization on user interaction');
    
    // These are the elements we'll listen for interactions on
    const interactionElements = [
        document.getElementById('start-btn'),
        document.getElementById('mic-toggle'),
        document.getElementById('fullscreen-btn')
    ].filter(el => el !== null);
    
    if (interactionElements.length === 0) {
        console.warn('No interaction elements found for audio initialization');
        return;
    }
    
    const initializeAudio = (event) => {
        console.debug(`Initializing audio context from user interaction: ${event.type} on ${event.target.id}`);
        
        // Create and resume the audio context
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.debug('AudioContext resumed successfully');
            });
        }
        
        // Store audio context in a global scope where p5.js can access it
        window._audioContext = audioContext;
        
        // Remove all event listeners once initialized
        interactionElements.forEach(el => {
            el.removeEventListener('click', initializeAudio);
        });
        
        // Let the app know audio is ready
        eventBus.emit('audio-context-ready', { audioContext });
    };
    
    // Add click listener to all interaction elements
    interactionElements.forEach(el => {
        el.addEventListener('click', initializeAudio);
        console.debug(`Added audio initialization listener to ${el.id}`);
    });
}

/**
 * Set up global error handling
 */
function setupErrorHandling() {
    // Handle uncaught errors and send to event bus
    window.onerror = (message, source, lineno, colno, error) => {
        console.error('Uncaught error:', error);
        
        // Send to event system
        eventBus.emit('app-error', { 
            message, 
            source, 
            lineno, 
            colno, 
            stack: error?.stack,
            state: stateMachine.getState()
        });
        
        // Transition to error state if not already there
        if (stateMachine.getState() !== AppStates.ERROR) {
            stateMachine.transition(AppStates.ERROR, { error });
        }
        
        // Don't prevent default error handling
        return false;
    };
    
    // Listen for audio errors and handle them
    eventBus.on('audio-error', (error) => {
        console.error('Audio subsystem error:', error);
        
        // Don't transition to error state for non-critical audio errors
        // Just log them for now
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Send to event system
        eventBus.emit('app-error', {
            type: 'unhandled-promise',
            reason: event.reason,
            state: stateMachine.getState()
        });
    });
}