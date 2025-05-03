/**
 * Event bus for application-wide event communication
 * Implements a publish-subscribe pattern for loosely coupled components
 */

// Debug configuration for event bus
const DEBUG = {
    subscribe: true,   // Log event subscriptions
    unsubscribe: true, // Log event unsubscriptions
    emit: true,        // Log event emissions
    detail: false,     // Log detailed event data (can be verbose)
    error: true,       // Log errors
    timing: false      // Log timing information for event handling
};

// Debug utility functions
function debug(category, ...args) {
    if (DEBUG[category]) {
        console.log(`%c[EventBus:${category}]`, 'color: #3273dc; font-weight: bold', ...args);
    }
}

function logError(message, ...args) {
    if (DEBUG.error) {
        console.error(`%c[EventBus:ERROR]`, 'color: #ff3860; font-weight: bold', message, ...args);
    }
}

class EventBus {
    constructor() {
        // Map to store event subscriptions
        this.subscribers = new Map();
        
        // Statistics for debugging
        this.stats = {
            totalEvents: 0,
            eventCounts: {},
            peakListenerCount: 0,
            activeSubscriptions: 0
        };
        
        debug('init', 'Event bus initialized');
    }
    
    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to subscribe to
     * @param {Function} callback - Function to call when event is emitted
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback) {
        // Validate inputs
        if (typeof eventName !== 'string') {
            logError('Invalid event name:', eventName);
            throw new Error('Event name must be a string');
        }
        
        if (typeof callback !== 'function') {
            logError('Invalid callback for event:', eventName);
            throw new Error('Event callback must be a function');
        }
        
        // Get or create subscriber list for this event
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, new Set());
            debug('subscribe', `Created new subscriber list for event: "${eventName}"`);
        }
        
        const subscribers = this.subscribers.get(eventName);
        
        // Add callback to subscribers
        subscribers.add(callback);
        this.stats.activeSubscriptions++;
        
        // Update statistics
        this.stats.peakListenerCount = Math.max(
            this.stats.peakListenerCount, subscribers.size
        );
        
        debug('subscribe', `Added subscriber to "${eventName}" (total: ${subscribers.size})`);
        
        // Return unsubscribe function
        return () => {
            this.off(eventName, callback);
        };
    }
    
    /**
     * Subscribe to an event once
     * @param {string} eventName - Name of the event to subscribe to
     * @param {Function} callback - Function to call when event is emitted
     * @returns {Function} Unsubscribe function
     */
    once(eventName, callback) {
        // Create a wrapper that will call the callback and unsubscribe
        const onceWrapper = (...args) => {
            this.off(eventName, onceWrapper);
            callback(...args);
        };
        
        debug('subscribe', `Added one-time subscriber to "${eventName}"`);
        
        // Return unsubscribe function from normal subscription
        return this.on(eventName, onceWrapper);
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event to unsubscribe from
     * @param {Function} callback - Function to remove from subscription list
     */
    off(eventName, callback) {
        if (!this.subscribers.has(eventName)) {
            debug('unsubscribe', `No subscribers found for event: "${eventName}"`);
            return false;
        }
        
        const subscribers = this.subscribers.get(eventName);
        const removed = subscribers.delete(callback);
        
        if (removed) {
            this.stats.activeSubscriptions--;
            debug('unsubscribe', `Removed subscriber from "${eventName}" (remaining: ${subscribers.size})`);
            
            // Clean up empty subscriber lists
            if (subscribers.size === 0) {
                this.subscribers.delete(eventName);
                debug('unsubscribe', `Removed empty subscriber list for event: "${eventName}"`);
            }
        } else {
            debug('unsubscribe', `Subscriber not found for event: "${eventName}"`);
        }
        
        return removed;
    }
    
    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Name of the event to emit
     * @param {any} data - Data to pass to subscribers
     */
    emit(eventName, data) {
        // Skip invalid event names with error
        if (typeof eventName !== 'string') {
            logError('Invalid event name:', eventName);
            return;
        }
        
        // Get subscriber list or empty set if none
        const subscribers = this.subscribers.get(eventName) || new Set();
        
        // Update statistics
        this.stats.totalEvents++;
        this.stats.eventCounts[eventName] = (this.stats.eventCounts[eventName] || 0) + 1;
        
        // Skip emission if no subscribers (but don't return early - we still want to log)
        const hasSubscribers = subscribers.size > 0;
        
        // Basic logging for all events
        debug('emit', `Emitting "${eventName}" to ${subscribers.size} subscribers`);
        
        // Detailed logging for event data if enabled
        if (DEBUG.detail && data !== undefined) {
            console.group(`%c[EventBus:detail] Event "${eventName}" data:`, 'color: #3273dc;');
            console.log(data);
            console.groupEnd();
        }
        
        // Don't bother iterating if no subscribers
        if (!hasSubscribers) {
            return;
        }
        
        // Timing start (if enabled)
        const startTime = DEBUG.timing ? performance.now() : 0;
        
        // Call each subscriber with the data
        try {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    logError(`Error in subscriber for "${eventName}":`, err);
                    console.error('Subscriber that caused error:', callback);
                    // Continue execution for other subscribers
                }
            });
        } catch (err) {
            logError(`Error iterating subscribers for "${eventName}":`, err);
        }
        
        // Timing end (if enabled)
        if (DEBUG.timing) {
            const duration = performance.now() - startTime;
            if (duration > 5) { // Only log slow events (> 5ms)
                debug('timing', `Event "${eventName}" took ${duration.toFixed(2)}ms to process`);
            }
        }
    }
    
    /**
     * Get all event names with active subscribers
     * @returns {string[]} Array of event names
     */
    getEventNames() {
        return Array.from(this.subscribers.keys());
    }
    
    /**
     * Get count of subscribers for a specific event
     * @param {string} eventName - Name of the event to check
     * @returns {number} Number of subscribers
     */
    getSubscriberCount(eventName) {
        const subscribers = this.subscribers.get(eventName);
        return subscribers ? subscribers.size : 0;
    }
    
    /**
     * Get overall event bus statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        // Create deep copy of stats to prevent external modification
        return {
            ...this.stats,
            eventCounts: { ...this.stats.eventCounts },
            activeEvents: this.getEventNames(),
            topEvents: this.getTopEvents(5)
        };
    }
    
    /**
     * Get the most frequently emitted events
     * @param {number} count - Number of top events to return
     * @returns {Array} Array of [eventName, count] pairs
     */
    getTopEvents(count = 5) {
        return Object.entries(this.stats.eventCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count);
    }
    
    /**
     * Log current event bus status to console (for debugging)
     */
    logStatus() {
        console.group('%c[EventBus:status] Current Status', 'color: #3273dc; font-weight: bold');
        
        console.log('Active events:', this.getEventNames());
        console.log('Total event emissions:', this.stats.totalEvents);
        console.log('Active subscriptions:', this.stats.activeSubscriptions);
        console.log('Peak listener count:', this.stats.peakListenerCount);
        
        // Top events by emission count
        console.group('Top events by emission count:');
        this.getTopEvents().forEach(([event, count]) => {
            console.log(`${event}: ${count}`);
        });
        console.groupEnd();
        
        // Events by subscriber count
        console.group('Events by subscriber count:');
        Array.from(this.subscribers.entries())
            .sort((a, b) => b[1].size - a[1].size)
            .forEach(([event, subscribers]) => {
                console.log(`${event}: ${subscribers.size} subscribers`);
            });
        console.groupEnd();
        
        console.groupEnd();
    }
    
    /**
     * Reset all event subscriptions and statistics
     */
    reset() {
        debug('reset', 'Resetting event bus - removing all subscriptions');
        this.subscribers.clear();
        
        this.stats = {
            totalEvents: 0,
            eventCounts: {},
            peakListenerCount: 0,
            activeSubscriptions: 0
        };
    }
}

// Export a singleton instance
export const eventBus = new EventBus();