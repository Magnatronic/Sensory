/**
 * UI Manager to handle all user interface interactions
 * This centralizes UI logic and keeps it separate from the application logic
 */
import { eventBus } from './core/event-bus.js';
import { settingsManager } from './core/app-config.js';
import { stateMachine, AppStates } from './core/state-machine.js';

export class UIManager {
    constructor() {
        this.elements = {};
        this.uiState = {
            isFullscreen: false,
            isMicEnabled: false,
            isRunning: false,
            selectedTheme: 'snowflakes'
        };
        
        // Track handler registrations to avoid duplicates
        this.registeredHandlers = new Map();
        
        console.debug('🖥️ UIManager: Initializing');
    }
    
    /**
     * Initialize the UI manager and cache DOM elements
     */
    initialize() {
        console.debug('🖥️ UIManager: Initializing UI elements and event handlers');
        
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI state
            this.updateUIState();
            
            console.debug('🖥️ UIManager: Initialization complete');
            return true;
        } catch (error) {
            console.error('🖥️ UIManager: Error initializing UI:', error);
            eventBus.emit('ui-error', { type: 'initialization', error });
            return false;
        }
    }
    
    /**
     * Cache DOM elements for quick access
     */
    cacheElements() {
        console.debug('🖥️ UIManager: Caching DOM elements');
        
        const selectors = {
            // Buttons
            'startBtn': '#start-btn',
            'stopBtn': '#stop-btn',
            'fullscreenBtn': '#fullscreen-btn',
            'micToggleBtn': '#mic-toggle',
            
            // Selectors
            'themeSelect': '#theme-select',
            
            // Sliders
            'soundThreshold': '#sound-threshold',
            'soundThresholdValue': '#sound-threshold-value',
            'burstIntensity': '#burst-intensity',
            'burstIntensityValue': '#burst-intensity-value',
            'burstSize': '#burst-size',
            'burstSizeValue': '#burst-size-value',
            'colorVariation': '#color-variation',
            'colorVariationValue': '#color-variation-value',
            
            // Theme specific controls
            'snowflakeCount': '#snowflake-count',
            'snowflakeCountValue': '#snowflake-count-value',
            'snowflakeSize': '#snowflake-size',
            'snowflakeSizeValue': '#snowflake-size-value',
            'snowflakeSpeed': '#snowflake-speed',
            'snowflakeSpeedValue': '#snowflake-speed-value',
            'wobbleIntensity': '#wobble-intensity',
            'wobbleIntensityValue': '#wobble-intensity-value',
            'windStrength': '#wind-strength',
            'windStrengthValue': '#wind-strength-value',
            'windDirection': '#wind-direction',
            'windDirectionValue': '#wind-direction-value',
            
            // Color pickers
            'backgroundColor': '#background-color',
            'snowflakeColor': '#snowflake-color',
            
            // Containers
            'canvasContainer': '#canvas-container',
            'volumeMeter': '#volume-level'
        };
        
        // Cache all elements
        this.elements = {};
        let missingElements = [];
        
        for (const [key, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements[key] = element;
            } else {
                console.warn(`🖥️ UIManager: Element not found: ${selector}`);
                missingElements.push(selector);
            }
        }
        
        console.debug(`🖥️ UIManager: Cached ${Object.keys(this.elements).length} DOM elements`);
        
        if (missingElements.length > 0) {
            console.warn('🖥️ UIManager: Could not find these elements:', missingElements);
        }
    }
    
    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        console.debug('🖥️ UIManager: Setting up UI event listeners');
        
        try {
            // Helper to register handlers and avoid duplicates
            const register = (element, event, handler, options = {}) => {
                if (!element) {
                    console.warn(`🖥️ UIManager: Cannot register handler for missing element (${event})`);
                    return;
                }
                
                // Create a key for this handler
                const key = `${element.id || 'unknown'}_${event}`;
                
                // If we already have a handler for this, remove it first
                if (this.registeredHandlers.has(key)) {
                    console.debug(`🖥️ UIManager: Removing previous handler for ${key}`);
                    const oldHandler = this.registeredHandlers.get(key);
                    element.removeEventListener(event, oldHandler);
                }
                
                // Register the new handler
                element.addEventListener(event, handler, options);
                this.registeredHandlers.set(key, handler);
                console.debug(`🖥️ UIManager: Registered handler for ${key}`);
            };
            
            // Button event listeners
            if (this.elements.startBtn) {
                register(this.elements.startBtn, 'click', () => {
                    console.debug('🖥️ UIManager: Start button clicked');
                    eventBus.emit('start-button-clicked');
                });
            }
            
            if (this.elements.stopBtn) {
                register(this.elements.stopBtn, 'click', () => {
                    console.debug('🖥️ UIManager: Stop button clicked');
                    eventBus.emit('stop-button-clicked');
                });
            }
            
            if (this.elements.fullscreenBtn) {
                register(this.elements.fullscreenBtn, 'click', () => {
                    console.debug('🖥️ UIManager: Fullscreen button clicked');
                    this.toggleFullscreen();
                });
            }
            
            if (this.elements.micToggleBtn) {
                register(this.elements.micToggleBtn, 'click', () => {
                    console.debug('🖥️ UIManager: Microphone toggle button clicked');
                    this.toggleMicrophone();
                });
            }
            
            // Theme selector
            if (this.elements.themeSelect) {
                register(this.elements.themeSelect, 'change', (e) => {
                    const theme = e.target.value;
                    console.debug(`🖥️ UIManager: Theme changed to "${theme}"`);
                    eventBus.emit('theme-changed', theme);
                    this.updateActiveThemeControls(theme);
                });
            }
            
            // Sliders - Using input for real-time updates
            this.setupSliderListeners();
            
            // Color pickers
            if (this.elements.backgroundColor) {
                register(this.elements.backgroundColor, 'input', (e) => {
                    console.debug(`🖥️ UIManager: Background color changed to ${e.target.value}`);
                    eventBus.emit('background-color-changed', e.target.value);
                });
            }
            
            if (this.elements.snowflakeColor) {
                register(this.elements.snowflakeColor, 'input', (e) => {
                    console.debug(`🖥️ UIManager: Snowflake color changed to ${e.target.value}`);
                    eventBus.emit('snowflake-color-changed', e.target.value);
                });
            }
            
            // Window resize handler
            window.addEventListener('resize', this.handleResize.bind(this));
            console.debug('🖥️ UIManager: Registered window resize handler');
            
            // Listen for app events
            this.registerAppEventListeners();
            
            console.debug('🖥️ UIManager: All event listeners registered');
        } catch (error) {
            console.error('🖥️ UIManager: Error setting up event listeners:', error);
            eventBus.emit('ui-error', { type: 'event-setup', error });
        }
    }
    
    /**
     * Set up all slider elements with event listeners
     */
    setupSliderListeners() {
        console.debug('🖥️ UIManager: Setting up slider input listeners');
        
        // Map of sliders to their value display elements and event names
        const sliderConfig = [
            {
                slider: 'soundThreshold', 
                valueDisplay: 'soundThresholdValue',
                event: 'sound-threshold-changed',
                valueTransform: value => value
            },
            {
                slider: 'burstIntensity', 
                valueDisplay: 'burstIntensityValue',
                event: 'burst-intensity-changed',
                valueTransform: value => value
            },
            {
                slider: 'burstSize', 
                valueDisplay: 'burstSizeValue',
                event: 'burst-size-changed',
                valueTransform: value => (value / 10).toFixed(1) // Convert 10-30 to 1.0-3.0
            },
            {
                slider: 'colorVariation', 
                valueDisplay: 'colorVariationValue',
                event: 'color-variation-changed',
                valueTransform: value => value
            },
            {
                slider: 'snowflakeCount', 
                valueDisplay: 'snowflakeCountValue',
                event: 'snowflake-count-changed',
                valueTransform: value => value
            },
            {
                slider: 'snowflakeSize', 
                valueDisplay: 'snowflakeSizeValue',
                event: 'snowflake-size-changed',
                valueTransform: value => value
            },
            {
                slider: 'snowflakeSpeed', 
                valueDisplay: 'snowflakeSpeedValue',
                event: 'snowflake-speed-changed',
                valueTransform: value => Number(value).toFixed(1)
            },
            {
                slider: 'wobbleIntensity', 
                valueDisplay: 'wobbleIntensityValue',
                event: 'wobble-intensity-changed',
                valueTransform: value => value
            },
            {
                slider: 'windStrength', 
                valueDisplay: 'windStrengthValue',
                event: 'wind-strength-changed',
                valueTransform: value => value
            },
            {
                slider: 'windDirection', 
                valueDisplay: 'windDirectionValue',
                event: 'wind-direction-changed',
                valueTransform: value => `${value}°`
            }
        ];
        
        // Set up each slider
        for (const config of sliderConfig) {
            this.setupSlider(config);
        }
    }
    
    /**
     * Set up a single slider with event handlers
     */
    setupSlider(config) {
        const { slider, valueDisplay, event, valueTransform } = config;
        
        const sliderElement = this.elements[slider];
        const valueElement = this.elements[valueDisplay];
        
        if (!sliderElement) {
            console.warn(`🖥️ UIManager: Slider element not found: ${slider}`);
            return;
        }
        
        if (!valueElement) {
            console.warn(`🖥️ UIManager: Value display element not found: ${valueDisplay}`);
            // Can still continue with just the slider
        }
        
        // Helper to register handlers and avoid duplicates
        const register = (element, eventName, handler) => {
            // Create a key for this handler
            const key = `${element.id || 'unknown'}_${eventName}`;
            
            // If we already have a handler for this, remove it first
            if (this.registeredHandlers.has(key)) {
                const oldHandler = this.registeredHandlers.get(key);
                element.removeEventListener(eventName, oldHandler);
            }
            
            // Register the new handler
            element.addEventListener(eventName, handler);
            this.registeredHandlers.set(key, handler);
            console.debug(`🖥️ UIManager: Registered handler for ${key}`);
        };
        
        // Update value display and emit event when slider changes
        const handleSliderChange = () => {
            const rawValue = sliderElement.value;
            const displayValue = valueTransform ? valueTransform(rawValue) : rawValue;
            
            if (valueElement) {
                valueElement.textContent = displayValue;
            }
            
            console.debug(`🖥️ UIManager: Slider ${slider} changed to ${rawValue} (displayed as ${displayValue})`);
            eventBus.emit(event, Number(rawValue));
        };
        
        // Listen for 'input' event for real-time updates as user drags
        register(sliderElement, 'input', handleSliderChange);
        
        // Initialize with current value
        handleSliderChange();
        
        console.debug(`🖥️ UIManager: Slider setup complete for ${slider}`);
    }
    
    /**
     * Register event listeners for app events
     */
    registerAppEventListeners() {
        console.debug('🖥️ UIManager: Registering app event listeners');
        
        // State changes
        eventBus.on('state-changed', (data) => {
            console.debug(`🖥️ UIManager: Handling state change from "${data.previousState}" to "${data.state}"`);
            this.handleStateChange(data.state, data.previousState);
        });
        
        // Audio events
        eventBus.on('volume-updated', (data) => {
            this.updateVolumeMeter(data.relative);
        });
        
        eventBus.on('audio-calibration-progress', (data) => {
            console.debug(`🖥️ UIManager: Calibration progress: ${Math.round(data.progress * 100)}%`);
            // Could update a progress indicator here
        });
        
        eventBus.on('audio-calibration-completed', (data) => {
            console.debug('🖥️ UIManager: Calibration completed with baseline:', data.baselineVolume);
            // Could update UI to show calibration is complete
        });
        
        eventBus.on('audio-error', (data) => {
            console.error(`🖥️ UIManager: Audio error of type "${data.type}"`, data.error);
            this.showErrorMessage(`Audio error: ${data.type}`, data.error?.message || 'Unknown error');
        });
        
        eventBus.on('microphone-permission-granted', () => {
            console.debug('🖥️ UIManager: Handling microphone permission granted');
            this.uiState.isMicEnabled = true;
            this.updateMicrophoneButton();
        });
        
        eventBus.on('microphone-permission-denied', (data) => {
            console.debug('🖥️ UIManager: Handling microphone permission denied', data);
            this.uiState.isMicEnabled = false;
            this.updateMicrophoneButton();
            this.showPermissionErrorMessage();
        });
        
        console.debug('🖥️ UIManager: App event listeners registered');
    }
    
    /**
     * Handle application state changes
     */
    handleStateChange(newState, previousState) {
        console.debug(`🖥️ UIManager: Handling state change to ${newState}`);
        
        switch (newState) {
            case AppStates.INITIALIZING:
                this.disableAllControls();
                break;
                
            case AppStates.READY:
                this.enableControls();
                this.updateButtonStates(false);
                break;
                
            case AppStates.RUNNING:
                this.uiState.isRunning = true;
                this.updateButtonStates(true);
                break;
                
            case AppStates.PAUSED:
                this.uiState.isRunning = false;
                this.updateButtonStates(false);
                break;
                
            case AppStates.CALIBRATING:
                // Show calibration UI
                this.disableControls(['startBtn', 'stopBtn']);
                break;
                
            case AppStates.ERROR:
                this.uiState.isRunning = false;
                this.updateButtonStates(false);
                break;
        }
        
        console.debug(`🖥️ UIManager: Completed state change handling for ${newState}`);
    }
    
    /**
     * Update the button states based on running state
     */
    updateButtonStates(isRunning) {
        console.debug(`🖥️ UIManager: Updating button states, isRunning=${isRunning}`);
        
        if (this.elements.startBtn) {
            this.elements.startBtn.disabled = isRunning;
        }
        
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !isRunning;
        }
    }
    
    /**
     * Enable or disable UI controls
     */
    enableControls(exclude = []) {
        console.debug('🖥️ UIManager: Enabling controls', exclude.length ? `(excluding ${exclude.join(', ')})` : '');
        
        // Enable all input elements except excluded ones
        for (const [key, element] of Object.entries(this.elements)) {
            if (exclude.includes(key)) continue;
            
            if (element.tagName === 'BUTTON' || element.tagName === 'INPUT' || element.tagName === 'SELECT') {
                element.disabled = false;
            }
        }
    }
    
    /**
     * Disable all or specific UI controls
     */
    disableAllControls(exclude = []) {
        console.debug('🖥️ UIManager: Disabling all controls', exclude.length ? `(excluding ${exclude.join(', ')})` : '');
        
        // Disable all input elements except excluded ones
        for (const [key, element] of Object.entries(this.elements)) {
            if (exclude.includes(key)) continue;
            
            if (element.tagName === 'BUTTON' || element.tagName === 'INPUT' || element.tagName === 'SELECT') {
                element.disabled = true;
            }
        }
    }
    
    /**
     * Disable specific UI controls
     */
    disableControls(controlKeys) {
        console.debug('🖥️ UIManager: Disabling specific controls:', controlKeys);
        
        for (const key of controlKeys) {
            const element = this.elements[key];
            if (element) {
                element.disabled = true;
            } else {
                console.warn(`🖥️ UIManager: Cannot disable missing control: ${key}`);
            }
        }
    }
    
    /**
     * Update which theme control sections are shown based on selected theme
     */
    updateActiveThemeControls(theme) {
        console.debug(`🖥️ UIManager: Updating active theme controls for "${theme}"`);
        
        // Hide all theme control sections
        const themeSections = document.querySelectorAll('.theme-controls');
        themeSections.forEach(section => {
            section.style.display = 'none';
        });
        
        // Show the selected theme's control section
        const activeSection = document.querySelector(`.${theme}-controls`);
        if (activeSection) {
            activeSection.style.display = 'block';
            console.debug(`🖥️ UIManager: Showing controls for ${theme}`);
        } else {
            console.warn(`🖥️ UIManager: No control section found for theme: ${theme}`);
        }
    }
    
    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        console.debug('🖥️ UIManager: Toggling fullscreen mode');
        
        const container = document.documentElement;
        
        if (!this.uiState.isFullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen().then(() => {
                    console.debug('🖥️ UIManager: Entered fullscreen mode');
                }).catch(err => {
                    console.error('🖥️ UIManager: Error entering fullscreen mode:', err);
                });
            } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => {
                    console.debug('🖥️ UIManager: Exited fullscreen mode');
                }).catch(err => {
                    console.error('🖥️ UIManager: Error exiting fullscreen mode:', err);
                });
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
        
        // Update state after transition
        document.addEventListener('fullscreenchange', () => {
            this.uiState.isFullscreen = !!document.fullscreenElement;
            console.debug(`🖥️ UIManager: Fullscreen state changed to: ${this.uiState.isFullscreen}`);
            this.updateFullscreenButton();
        }, { once: true });
    }
    
    /**
     * Update fullscreen button text based on state
     */
    updateFullscreenButton() {
        if (this.elements.fullscreenBtn) {
            this.elements.fullscreenBtn.textContent = this.uiState.isFullscreen ? 'Exit Full Screen' : 'Full Screen';
            console.debug(`🖥️ UIManager: Updated fullscreen button text to "${this.elements.fullscreenBtn.textContent}"`);
        }
    }
    
    /**
     * Toggle microphone enabled state
     */
    toggleMicrophone() {
        console.debug('🖥️ UIManager: Toggling microphone state');
        const newState = !this.uiState.isMicEnabled;
        
        eventBus.emit(newState ? 'enable-microphone' : 'disable-microphone');
        
        // The actual state will be updated when we receive a response event
        console.debug(`🖥️ UIManager: Requested microphone state change to: ${newState}`);
    }
    
    /**
     * Update microphone button based on current state
     */
    updateMicrophoneButton() {
        if (this.elements.micToggleBtn) {
            this.elements.micToggleBtn.textContent = this.uiState.isMicEnabled ? 'Disable Microphone' : 'Enable Microphone';
            this.elements.micToggleBtn.classList.toggle('active', this.uiState.isMicEnabled);
            console.debug(`🖥️ UIManager: Updated microphone button to "${this.elements.micToggleBtn.textContent}" (active: ${this.uiState.isMicEnabled})`);
        }
    }
    
    /**
     * Update the volume meter based on current audio level
     */
    updateVolumeMeter(level) {
        if (!this.elements.volumeMeter) return;
        
        // Convert to percentage (0-100)
        const percentage = Math.min(100, Math.max(0, level * 300));
        this.elements.volumeMeter.style.width = `${percentage}%`;
        
        // Only log occasionally to not flood console
        if (Math.random() < 0.01) { // About 1% of frames
            console.debug(`🖥️ UIManager: Volume meter updated to ${percentage.toFixed(1)}%`);
        }
        
        // Color coding based on level
        if (percentage > 75) {
            this.elements.volumeMeter.style.backgroundColor = '#ff5252';
        } else if (percentage > 40) {
            this.elements.volumeMeter.style.backgroundColor = '#ffbd52';
        } else {
            this.elements.volumeMeter.style.backgroundColor = '#4caf50';
        }
    }
    
    /**
     * Handle window resize events
     */
    handleResize() {
        console.debug('🖥️ UIManager: Window resized:', window.innerWidth, 'x', window.innerHeight);
        eventBus.emit('window-resized', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }
    
    /**
     * Update the UI state with current settings
     */
    updateUIState() {
        console.debug('🖥️ UIManager: Updating UI state from settings');
        
        // Set theme selector to current theme
        const currentTheme = settingsManager.get('currentTheme', 'snowflakes');
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = currentTheme;
            this.updateActiveThemeControls(currentTheme);
            console.debug(`🖥️ UIManager: Set theme selector to "${currentTheme}"`);
        }
        
        // Set sliders to their saved values
        this.updateSlidersFromSettings();
        
        // Set color pickers to saved values
        this.updateColorPickersFromSettings();
        
        // Update button states based on current app state
        this.updateButtonStates(stateMachine.isInState(AppStates.RUNNING));
        
        console.debug('🖥️ UIManager: UI state updated from settings');
    }
    
    /**
     * Update all sliders from saved settings
     */
    updateSlidersFromSettings() {
        console.debug('🖥️ UIManager: Updating sliders from settings');
        
        const sliderMappings = [
            {
                element: 'soundThreshold',
                setting: 'audio.threshold',
                transform: (value) => Math.round(value * 100) // Convert 0-1 to 0-100
            },
            {
                element: 'burstIntensity',
                setting: 'themes.snowflakes.burstIntensity',
                transform: (value) => value
            },
            {
                element: 'burstSize',
                setting: 'themes.snowflakes.burstSizeMultiplier',
                transform: (value) => Math.round(value * 10) // Convert 1.0-3.0 to 10-30
            },
            {
                element: 'colorVariation',
                setting: 'themes.snowflakes.colorVariation',
                transform: (value) => value
            },
            {
                element: 'snowflakeCount',
                setting: 'themes.snowflakes.defaultCount',
                transform: (value) => value
            },
            {
                element: 'snowflakeSize',
                setting: 'themes.snowflakes.defaultSize',
                transform: (value) => value
            },
            {
                element: 'snowflakeSpeed',
                setting: 'themes.snowflakes.defaultSpeed',
                transform: (value) => value
            },
            {
                element: 'wobbleIntensity',
                setting: 'themes.snowflakes.defaultWobbleIntensity',
                transform: (value) => Math.round(value * 10) // Convert 0.0-1.0 to 0-10
            }
        ];
        
        for (const mapping of sliderMappings) {
            const element = this.elements[mapping.element];
            if (!element) continue;
            
            const savedValue = settingsManager.get(mapping.setting);
            if (savedValue !== null && savedValue !== undefined) {
                const sliderValue = mapping.transform(savedValue);
                element.value = sliderValue;
                
                // Update the display value if it exists
                const valueElement = this.elements[`${mapping.element}Value`];
                if (valueElement) {
                    valueElement.textContent = mapping.element === 'burstSize' ? (sliderValue / 10).toFixed(1) : sliderValue;
                }
                
                console.debug(`🖥️ UIManager: Updated slider ${mapping.element} to ${sliderValue}`);
            }
        }
    }
    
    /**
     * Update color pickers from saved settings
     */
    updateColorPickersFromSettings() {
        console.debug('🖥️ UIManager: Updating color pickers from settings');
        
        const colorMappings = [
            {
                element: 'backgroundColor',
                setting: 'themes.snowflakes.defaultBackground'
            },
            {
                element: 'snowflakeColor',
                setting: 'themes.snowflakes.defaultColor'
            }
        ];
        
        for (const mapping of colorMappings) {
            const element = this.elements[mapping.element];
            if (!element) continue;
            
            const savedValue = settingsManager.get(mapping.setting);
            if (savedValue) {
                element.value = savedValue;
                console.debug(`🖥️ UIManager: Updated color picker ${mapping.element} to ${savedValue}`);
            }
        }
    }
    
    /**
     * Show error message for permissions issues
     */
    showPermissionErrorMessage() {
        console.debug('🖥️ UIManager: Showing microphone permission error message');
        
        const message = `
            <div class="error-message">
                <h3>Microphone Access Required</h3>
                <p>This app needs access to your microphone to detect sounds and create visual effects.</p>
                <p>Please check your browser settings and ensure microphone access is allowed for this site.</p>
                <button id="dismiss-error">Got It</button>
            </div>
        `;
        
        this.showErrorOverlay(message);
    }
    
    /**
     * Show generic error message
     */
    showErrorMessage(title, message) {
        console.debug(`🖥️ UIManager: Showing error message: ${title}`);
        
        const errorHtml = `
            <div class="error-message">
                <h3>${title}</h3>
                <p>${message}</p>
                <button id="dismiss-error">Dismiss</button>
            </div>
        `;
        
        this.showErrorOverlay(errorHtml);
    }
    
    /**
     * Show error overlay with message
     */
    showErrorOverlay(html) {
        console.debug('🖥️ UIManager: Creating error overlay');
        
        let overlay = document.querySelector('.error-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'error-overlay';
            document.body.appendChild(overlay);
        }
        
        overlay.innerHTML = html;
        overlay.style.display = 'flex';
        
        // Add dismiss handler
        const dismissButton = document.getElementById('dismiss-error');
        if (dismissButton) {
            dismissButton.addEventListener('click', () => {
                console.debug('🖥️ UIManager: Error dismissed by user');
                overlay.style.display = 'none';
            });
        }
    }
}

// Export a singleton instance
export const uiManager = new UIManager();