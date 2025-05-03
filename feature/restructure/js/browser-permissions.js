/**
 * BrowserPermissions class handles permission requests in a browser-agnostic way
 * focusing on microphone access for audio features
 */
import { eventBus } from './core/event-bus.js';
import { settingsManager } from './core/app-config.js';

export class BrowserPermissions {
    constructor() {
        this.permissions = {};
        this.permissionCallbacks = {};
        console.debug('🔐 BrowserPermissions: Initialized');
    }

    /**
     * Check if microphone permission has been granted
     * @returns {Promise<boolean>} True if permission is granted
     */
    async checkMicrophonePermission() {
        try {
            console.debug('🔐 BrowserPermissions: Checking microphone permission status');
            
            // Try to use the Permissions API if available
            if (navigator.permissions && navigator.permissions.query) {
                console.debug('🔐 BrowserPermissions: Using Permissions API');
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                
                console.debug(`🔐 BrowserPermissions: Microphone permission status: ${permissionStatus.state}`);
                
                // Emit event for permission state
                eventBus.emit('microphone-permission-status', { state: permissionStatus.state });
                
                return permissionStatus.state === 'granted';
            }
            
            // Fallback: we can't determine permission status without requesting
            console.debug('🔐 BrowserPermissions: Permissions API not available, status unknown');
            eventBus.emit('microphone-permission-status', { state: 'unknown' });
            return null; // null means "unknown"
        } catch (error) {
            console.warn('🔐 BrowserPermissions: Error checking microphone permission:', error);
            eventBus.emit('microphone-permission-error', { error });
            return null; // null means "unknown"
        }
    }

    /**
     * Request microphone permission and retrieve a media stream
     * @returns {Promise<Object>} Object with {granted: boolean, stream: MediaStream}
     */
    async requestMicrophoneAccess() {
        try {
            console.debug('🔐 BrowserPermissions: Requesting microphone access');
            eventBus.emit('microphone-permission-requesting');
            
            console.debug('🔐 BrowserPermissions: Calling getUserMedia({ audio: true })');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Save permission state
            settingsManager.set('audio.permissionGranted', true);
            
            console.debug('🔐 BrowserPermissions: Microphone access granted successfully');
            eventBus.emit('microphone-permission-granted', { stream });
            return { granted: true, stream };
        } catch (error) {
            console.error('🔐 BrowserPermissions: Error requesting microphone access:', error);
            
            // Save permission state
            settingsManager.set('audio.permissionGranted', false);
            
            // Check for specific error types
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                console.debug('🔐 BrowserPermissions: Permission explicitly denied by user');
            } else if (error.name === 'NotFoundError') {
                console.debug('🔐 BrowserPermissions: No microphone hardware found');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                console.debug('🔐 BrowserPermissions: Microphone is already in use or not functioning');
            }
            
            eventBus.emit('microphone-permission-denied', { error });
            return { granted: false, stream: null, error };
        }
    }

    /**
     * Check if the browser fully supports the required audio features
     * @returns {Object} Object with support status for various features
     */
    checkAudioSupport() {
        console.debug('🔐 BrowserPermissions: Checking browser audio feature support');
        
        const support = {
            webAudioAPI: !!(window.AudioContext || window.webkitAudioContext),
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            audioWorklet: !!(window.AudioContext && window.AudioContext.prototype.audioWorklet),
            permissions: !!(navigator.permissions && navigator.permissions.query),
            mediaCapabilities: !!(navigator.mediaCapabilities),
        };
        
        // Overall support level
        support.fullSupport = support.webAudioAPI && support.getUserMedia;
        support.partialSupport = support.fullSupport; // Currently the same, can be extended
        
        console.debug('🔐 BrowserPermissions: Audio support check results:', support);
        
        // Save feature detection results
        settingsManager.set('browser.audioSupport', support);
        
        // Emit event
        eventBus.emit('audio-support-detected', support);
        
        return support;
    }

    /**
     * Detect if running in a Chromium-based browser with enhanced privacy features
     * that might affect audio permissions (used for more informative UI)
     */
    detectEnhancedPrivacyMode() {
        console.debug('🔐 BrowserPermissions: Detecting enhanced privacy mode in browser');
        
        const ua = navigator.userAgent;
        const isChromium = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(ua);
        const isFirefox = /Firefox/.test(ua);
        
        console.debug(`🔐 BrowserPermissions: User agent info - Chromium: ${isChromium}, Edge: ${isEdge}, Firefox: ${isFirefox}`);
        
        // Create privacy detection results without attempting to create AudioContext
        const result = {
            isPrivacyFocused: false,
            possibleIssues: [],
            browserInfo: {
                userAgent: ua,
                isChromium,
                isEdge,
                isFirefox
            }
        };
        
        // Modern browsers generally require user interaction for audio
        if (isChromium || isEdge || isFirefox) {
            console.debug('🔐 BrowserPermissions: Modern browser detected, assuming autoplay restrictions');
            result.possibleIssues.push('audio-autoplay-restricted');
        }
        
        console.debug('🔐 BrowserPermissions: Privacy mode detection results:', result);
        
        // Save detection results
        settingsManager.set('browser.privacyMode', result);
        
        // Emit event
        eventBus.emit('privacy-mode-detected', result);
        
        return result;
    }
}

// Export a singleton instance
export const browserPermissions = new BrowserPermissions();