/**
 * State machine for managing application state transitions
 */
import { eventBus } from './event-bus.js';
import { settingsManager } from './app-config.js';

// Define application states
export const AppStates = {
    INITIALIZING: 'initializing',  // App is starting up
    READY: 'ready',                // App is ready but not running
    RUNNING: 'running',            // App is actively running
    CALIBRATING: 'calibrating',    // App is calibrating audio
    PAUSED: 'paused',              // App is paused
    ERROR: 'error'                 // App encountered an error
};

// Define valid state transitions
const validTransitions = {
    [AppStates.INITIALIZING]: [AppStates.READY, AppStates.ERROR],
    [AppStates.READY]: [AppStates.RUNNING, AppStates.CALIBRATING, AppStates.ERROR],
    [AppStates.RUNNING]: [AppStates.PAUSED, AppStates.READY, AppStates.ERROR],
    [AppStates.CALIBRATING]: [AppStates.READY, AppStates.RUNNING, AppStates.ERROR],
    [AppStates.PAUSED]: [AppStates.RUNNING, AppStates.READY, AppStates.ERROR],
    [AppStates.ERROR]: [AppStates.INITIALIZING, AppStates.READY]
};

// Debug configuration
const DEBUG = {
    transition: true,  // Log state transitions
    validation: true,  // Log transition validation
    history: true,     // Log state history
    error: true,       // Log errors
    detail: true       // Log detailed state data
};

// Debug utilities
function debug(category, ...args) {
    if (DEBUG[category]) {
        console.log(`%c[StateMachine:${category}]`, 'color: #23d160; font-weight: bold', ...args);
    }
}

function logError(...args) {
    if (DEBUG.error) {
        console.error(`%c[StateMachine:ERROR]`, 'color: #ff3860; font-weight: bold', ...args);
    }
}

/**
 * Class that manages application state transitions
 */
class StateMachine {
    constructor() {
        this.currentState = AppStates.INITIALIZING;
        this.previousState = null;
        this.stateData = {};
        this.stateHistory = [];
        this.maxHistoryLength = 20; // Limit history to prevent memory issues
        
        // Initialize the state history with the initial state
        this.recordStateTransition(null, this.currentState, {
            timestamp: Date.now(),
            reason: 'initialization'
        });
        
        debug('init', 'State machine initialized in state:', this.currentState);
    }
    
    /**
     * Attempt to transition to a new state
     * @param {string} newState - The state to transition to
     * @param {Object} data - Optional data to associate with the state
     * @param {string} reason - Optional reason for the transition
     * @returns {boolean} Whether the transition was successful
     */
    transition(newState, data = {}, reason = '') {
        debug('transition', `Attempting transition: ${this.currentState} -> ${newState}`, reason ? `(${reason})` : '');
        
        // Validate the transition
        if (!this.canTransitionTo(newState)) {
            logError(`Invalid state transition: ${this.currentState} -> ${newState}`);
            eventBus.emit('state-transition-invalid', { 
                from: this.currentState,
                to: newState,
                reason
            });
            return false;
        }
        
        // Update state tracking
        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateData = { ...data };
        
        // Record in history
        this.recordStateTransition(this.previousState, newState, {
            timestamp: Date.now(),
            reason,
            data: DEBUG.detail ? { ...data } : undefined
        });
        
        // Emit state change event
        eventBus.emit('state-changed', {
            from: this.previousState,
            to: newState,
            data,
            reason
        });
        
        // Store current state in settings
        settingsManager.set('app.currentState', newState);
        
        debug('transition', `Transitioned to ${newState} from ${this.previousState}`);
        
        return true;
    }
    
    /**
     * Check if a transition to the given state is valid
     */
    canTransitionTo(state) {
        const validNextStates = validTransitions[this.currentState];
        const isValid = validNextStates && validNextStates.includes(state);
        
        if (DEBUG.validation) {
            if (isValid) {
                debug('validation', `Transition from ${this.currentState} to ${state} is valid`);
            } else {
                debug('validation', `Transition from ${this.currentState} to ${state} is INVALID! Valid targets: ${validNextStates}`);
            }
        }
        
        return isValid;
    }
    
    /**
     * Get the current application state
     */
    getState() {
        return this.currentState;
    }
    
    /**
     * Get the previous application state
     */
    getPreviousState() {
        return this.previousState;
    }
    
    /**
     * Get data associated with the current state
     */
    getStateData() {
        return { ...this.stateData };
    }
    
    /**
     * Record a state transition in the history
     */
    recordStateTransition(fromState, toState, metadata) {
        if (!DEBUG.history) return;
        
        this.stateHistory.push({
            from: fromState,
            to: toState,
            ...metadata
        });
        
        // Trim history if it gets too long
        if (this.stateHistory.length > this.maxHistoryLength) {
            this.stateHistory.shift();
        }
        
        debug('history', `Recorded transition ${fromState} -> ${toState} in history (${this.stateHistory.length} entries)`);
    }
    
    /**
     * Get the state transition history
     */
    getStateHistory() {
        return [...this.stateHistory];
    }
    
    /**
     * Check if the current state matches the given state
     */
    isInState(state) {
        return this.currentState === state;
    }
    
    /**
     * Force a state (use sparingly, mainly for initialization and recovery)
     */
    forceState(state, data = {}, reason = 'forced') {
        logError(`Forcing state to ${state} from ${this.currentState} - ${reason}`);
        
        // Update state tracking
        this.previousState = this.currentState;
        this.currentState = state;
        this.stateData = { ...data };
        
        // Record in history
        this.recordStateTransition(this.previousState, state, {
            timestamp: Date.now(),
            reason: `FORCED: ${reason}`,
            data: DEBUG.detail ? { ...data } : undefined
        });
        
        // Emit forced state change event
        eventBus.emit('state-forced', {
            from: this.previousState,
            to: state,
            data,
            reason
        });
        
        // Also emit regular state changed event
        eventBus.emit('state-changed', {
            from: this.previousState,
            to: state,
            data,
            reason: `FORCED: ${reason}`
        });
        
        // Store current state in settings
        settingsManager.set('app.currentState', state);
        
        return true;
    }
    
    /**
     * Reset to the initial state
     */
    reset() {
        debug('transition', 'Resetting state machine to INITIALIZING state');
        return this.forceState(AppStates.INITIALIZING, {}, 'system reset');
    }
    
    /**
     * Log the current state machine status to console (for debugging)
     */
    logStatus() {
        console.group('%c[StateMachine:status] Current Status', 'color: #23d160; font-weight: bold');
        
        console.log('Current state:', this.currentState);
        console.log('Previous state:', this.previousState);
        console.log('State data:', this.stateData);
        
        // State history table
        console.group('State History (most recent last):');
        console.table(this.stateHistory.map((entry, index) => ({
            '#': index + 1,
            'From': entry.from || '(initial)',
            'To': entry.to,
            'Time': new Date(entry.timestamp).toLocaleTimeString(),
            'Reason': entry.reason || 'N/A'
        })));
        console.groupEnd();
        
        console.groupEnd();
    }
}

// Export a singleton instance
export const stateMachine = new StateMachine();