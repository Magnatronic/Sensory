/**
 * Main application entry point
 * Initializes core components and starts the application
 */
import { eventBus } from './core/event-bus.js';
import { settingsManager } from './core/app-config.js';
import { stateMachine, AppStates } from './core/state-machine.js';
import { browserPermissions } from './browser-permissions.js';

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Music Therapy Sensory App initializing...');
    
    // Check for browser audio support
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
    
    // Note: p5.js will automatically run the setup() and draw() functions
    // defined in sketch.js once the p5.js library is loaded
});

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