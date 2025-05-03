/**
 * BrowserAudioDetector class provides a unified API for audio detection
 * that works consistently across browsers using feature detection
 * rather than browser detection.
 */
import { eventBus } from './core/event-bus.js';
import { settingsManager } from './core/app-config.js';
import { stateMachine, AppStates } from './core/state-machine.js';

// Create a debug logger specific to this module
const DEBUG = {
    init: true,      // Initialization logs
    audio: true,     // Audio processing logs
    perms: true,     // Permission handling logs
    detect: true,    // Sound detection logs
    volume: false,   // Volume update logs (high frequency, disabled by default)
    calibrate: true, // Calibration logs
    error: true      // Error logs
};

// Unified debug logging function
function debug(category, ...args) {
    if (DEBUG[category]) {
        console.log(`%c[AudioDetector:${category}]`, 'color: #00a8e8; font-weight: bold', ...args);
    }
}

// Error logging function
function logError(category, ...args) {
    if (DEBUG.error) {
        console.error(`%c[AudioDetector:${category}:ERROR]`, 'color: #ff3860; font-weight: bold', ...args);
    }
}

export class BrowserAudioDetector {
    constructor(config = {}) {
        debug('init', 'Initializing BrowserAudioDetector with config:', config);
        
        // Core audio objects
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.analyserNode = null;
        this.dataArray = null;
        
        // Detection settings from configuration
        this.threshold = config.threshold || settingsManager.get('audio.threshold', 0.05);
        this.smoothing = config.smoothing || settingsManager.get('audio.smoothing', 0.8);
        this.prevVolume = 0;
        this.currentVolume = 0;
        this.volumeHistory = Array(30).fill(0);
        this.baselineVolume = 0;
        
        // Calibration settings
        this.calibrating = false;
        this.calibrationSamples = [];
        this.calibrationDuration = config.calibrationDuration || 
            settingsManager.get('audio.calibrationDuration', 60);
        
        // Cooldown to prevent too many triggers
        this.cooldownTime = config.cooldownTime || 
            settingsManager.get('audio.cooldownTime', 300);
        this.lastTriggerTime = 0;
        
        // State tracking
        this.isSetup = false;
        this.isEnabled = false;
        this.permissionGranted = false;
        
        // Performance optimization settings
        this.fftSize = config.fftSize || settingsManager.get('audio.fftSize', 32);
        this.updateInterval = null;
        
        debug('init', 'BrowserAudioDetector initialized with:', {
            threshold: this.threshold,
            smoothing: this.smoothing,
            calibrationDuration: this.calibrationDuration,
            cooldownTime: this.cooldownTime,
            fftSize: this.fftSize
        });
    }

    /**
     * Initialize the Web Audio API context with error handling and fallbacks
     */
    async setup() {
        debug('init', 'Setting up audio context...');
        try {
            if (this.isSetup) {
                debug('init', 'Audio already set up, skipping');
                return true;
            }
            
            // Create AudioContext with appropriate fallbacks
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                logError('init', 'Web Audio API not supported in this browser');
                eventBus.emit('audio-error', { type: 'unsupported', message: 'Web Audio API not supported' });
                return false;
            }
            
            debug('init', 'Creating AudioContext...');
            this.audioContext = new AudioContext();
            debug('init', 'AudioContext created, state:', this.audioContext.state);
            
            // Create analyzer node
            debug('init', 'Creating AnalyserNode...');
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = this.fftSize;
            this.analyserNode.smoothingTimeConstant = this.smoothing;
            
            // Create buffer for analyzer data
            this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
            debug('init', `AnalyserNode created with fftSize: ${this.fftSize}, frequencyBinCount: ${this.analyserNode.frequencyBinCount}`);
            
            this.isSetup = true;
            eventBus.emit('audio-setup-completed');
            debug('init', 'Audio setup completed successfully');
            return true;
        } catch (error) {
            logError('init', 'Error setting up audio:', error);
            eventBus.emit('audio-error', { type: 'setup', error });
            return false;
        }
    }

    /**
     * Display a permission prompt overlay to guide users
     */
    showPermissionPrompt() {
        debug('perms', 'Showing custom permission prompt');
        const overlay = document.createElement('div');
        overlay.className = 'permission-overlay';
        overlay.innerHTML = `
            <div class="permission-box">
                <h3>Microphone Permission Required</h3>
                <p>This app needs access to your microphone to detect sounds and create visual effects.</p>
                <p>When prompted, please click <strong>"Allow"</strong> to enable the microphone.</p>
                <div class="permission-image">
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                </div>
                <button id="request-permission-btn">Request Microphone Access</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        return new Promise((resolve) => {
            document.getElementById('request-permission-btn').addEventListener('click', async () => {
                try {
                    debug('perms', 'Permission request button clicked, requesting microphone access...');
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    this.mediaStream = stream;
                    this.permissionGranted = true;
                    debug('perms', 'Permission granted via custom prompt');
                    eventBus.emit('microphone-permission-granted');
                    overlay.remove();
                    resolve(true);
                } catch (err) {
                    logError('perms', "Permission denied via custom prompt:", err);
                    eventBus.emit('microphone-permission-denied', { error: err });
                    overlay.innerHTML = `
                        <div class="permission-box">
                            <h3>Permission Denied</h3>
                            <p>Microphone access was denied. Without microphone access, sound detection will not work.</p>
                            <p>To fix this:</p>
                            <ol>
                                <li>Click the camera/lock icon in your browser's address bar</li>
                                <li>Select "Site permissions"</li>
                                <li>Change microphone setting to "Allow"</li>
                                <li>Refresh this page</li>
                            </ol>
                            <button id="close-permission-btn">Close</button>
                        </div>
                    `;
                    document.getElementById('close-permission-btn').addEventListener('click', () => {
                        debug('perms', 'Permission prompt closed by user after denial');
                        overlay.remove();
                        resolve(false);
                    });
                }
            });
        });
    }

    /**
     * Check and request microphone permissions using consistent approaches
     */
    async requestPermissions() {
        debug('perms', 'Requesting microphone permissions...');
        try {
            eventBus.emit('microphone-permission-requesting');
            
            // Try to use Permissions API if available
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    debug('perms', 'Using Permissions API to check microphone status');
                    const result = await navigator.permissions.query({ name: 'microphone' });
                    debug('perms', 'Permissions API result:', result.state);
                    
                    if (result.state === 'denied') {
                        debug('perms', 'Microphone permission previously denied');
                        eventBus.emit('microphone-permission-blocked');
                        return false;
                    } else if (result.state === 'granted') {
                        debug('perms', 'Microphone permission previously granted');
                        this.permissionGranted = true;
                        eventBus.emit('microphone-permission-granted');
                        return true;
                    }
                    debug('perms', 'Microphone permission in prompt state, continuing with request');
                    // If prompt state, continue with the getUserMedia request below
                } catch (err) {
                    debug('perms', "Could not use Permissions API:", err);
                    // Continue with getUserMedia as fallback
                }
            }
            
            // Standard approach: directly request the stream
            try {
                debug('perms', 'Directly requesting getUserMedia for microphone access');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaStream = stream;
                this.permissionGranted = true;
                debug('perms', 'Microphone permission granted via getUserMedia');
                eventBus.emit('microphone-permission-granted');
                return true;
            } catch (err) {
                // If direct request fails, show custom UI
                debug('perms', "Direct permission request failed:", err);
                debug('perms', "Showing custom permission UI");
                return await this.showPermissionPrompt();
            }
        } catch (error) {
            logError('perms', 'Error requesting permissions:', error);
            eventBus.emit('audio-error', { type: 'permissions', error });
            return false;
        }
    }

    /**
     * Start listening to microphone input
     */
    async start() {
        debug('audio', 'Starting audio detector...');
        if (!this.isSetup) {
            debug('audio', 'Audio not set up yet, running setup first');
            const setupSuccess = await this.setup();
            if (!setupSuccess) {
                logError('audio', 'Setup failed, cannot start audio detector');
                return false;
            }
        }
        
        try {
            // Resume audio context if it was suspended (autoplay policy)
            if (this.audioContext.state === 'suspended') {
                debug('audio', 'AudioContext suspended, attempting to resume...');
                await this.audioContext.resume();
                debug('audio', 'AudioContext resumed, new state:', this.audioContext.state);
            }
            
            // Check permissions
            if (!this.permissionGranted) {
                debug('audio', 'No permission yet, requesting...');
                const permissionGranted = await this.requestPermissions();
                if (!permissionGranted) {
                    logError('audio', 'Permission denied, cannot start audio detector');
                    return false;
                }
                debug('audio', 'Permission granted, continuing with audio detector start');
            }
            
            // If we already have a stream, reconnect it
            if (this.mediaStream) {
                debug('audio', 'Using existing media stream to connect audio');
                this.connectStream(this.mediaStream);
            } else {
                // Get a new stream
                try {
                    debug('audio', 'No existing stream, requesting new media stream');
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    this.connectStream(stream);
                } catch (err) {
                    logError('audio', "Error accessing microphone:", err);
                    eventBus.emit('audio-error', { type: 'stream', error: err });
                    return false;
                }
            }
            
            // Begin calibration
            this.startCalibration();
            
            // Start regular updates
            this.startUpdates();
            
            this.isEnabled = true;
            debug('audio', 'Audio detector started successfully');
            eventBus.emit('audio-detector-started');
            return true;
        } catch (error) {
            logError('audio', 'Error starting microphone:', error);
            eventBus.emit('audio-error', { type: 'start', error });
            this.isEnabled = false;
            return false;
        }
    }
    
    /**
     * Connect the media stream to the audio analysis chain
     */
    connectStream(stream) {
        debug('audio', 'Connecting media stream to audio graph');
        this.mediaStream = stream;
        
        // Log audio tracks info for debugging
        const audioTracks = stream.getAudioTracks();
        debug('audio', `Stream has ${audioTracks.length} audio tracks:`, 
              audioTracks.map(track => ({
                  label: track.label,
                  enabled: track.enabled,
                  muted: track.muted,
                  readyState: track.readyState
              }))
        );
        
        // Disconnect any existing source
        if (this.sourceNode) {
            debug('audio', 'Disconnecting previous source node');
            this.sourceNode.disconnect();
        }
        
        // Create source from the stream
        debug('audio', 'Creating MediaStreamSourceNode from stream');
        this.sourceNode = this.audioContext.createMediaStreamSource(stream);
        
        // Connect the source to the analyzer
        debug('audio', 'Connecting source to analyzer node');
        this.sourceNode.connect(this.analyserNode);
        
        eventBus.emit('audio-stream-connected');
        debug('audio', 'Media stream connected successfully');
    }
    
    /**
     * Start the calibration process to establish a baseline noise level
     */
    startCalibration() {
        debug('calibrate', `Starting microphone calibration for ${this.calibrationDuration} frames...`);
        this.calibrating = true;
        this.calibrationSamples = [];
        
        stateMachine.transition(AppStates.CALIBRATING);
        eventBus.emit('audio-calibration-started');
    }
    
    /**
     * Start a regular update loop for audio processing
     */
    startUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            debug('audio', 'Clearing previous update interval');
            clearInterval(this.updateInterval);
        }
        
        const updateFrequency = settingsManager.get('ui.volumeMeterUpdateFrequency', 33);
        debug('audio', `Starting audio update interval with frequency ${updateFrequency}ms`);
        
        // Set up a new interval (approximately 30fps)
        this.updateInterval = setInterval(() => {
            this.update();
        }, updateFrequency);
    }

    /**
     * Stop listening to microphone input
     */
    stop() {
        debug('audio', 'Stopping audio detector...');
        if (this.updateInterval) {
            debug('audio', 'Clearing update interval');
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.mediaStream) {
            debug('audio', 'Stopping all media stream tracks');
            // Stop all tracks in the media stream
            this.mediaStream.getTracks().forEach(track => {
                debug('audio', `Stopping track: ${track.label}`);
                track.stop();
            });
            this.mediaStream = null;
        }
        
        if (this.sourceNode) {
            debug('audio', 'Disconnecting source node');
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        this.isEnabled = false;
        debug('audio', 'Audio detector stopped');
        eventBus.emit('audio-detector-stopped');
    }

    /**
     * Set the sound detection threshold with intuitive scaling
     */
    setThreshold(value) {
        debug('audio', `Setting threshold with raw value: ${value}`);
        
        // Apply non-linear scaling to make the control more intuitive
        // Lower values (0-0.3) map to a smaller range for fine control at high sensitivity
        // Higher values (0.3-1) map to a wider range for less sensitive settings
        let scaledValue;
        if (value < 0.3) {
            // Map 0-0.3 to 0.01-0.05 (very sensitive)
            scaledValue = 0.01 + (value / 0.3) * 0.04;
        } else {
            // Map 0.3-1.0 to 0.05-0.3 (less sensitive)
            scaledValue = 0.05 + ((value - 0.3) / 0.7) * 0.25;
        }
        
        this.threshold = Math.max(0.01, Math.min(0.3, scaledValue));
        
        // Save to settings
        settingsManager.set('audio.threshold', this.threshold);
        
        debug('audio', `Sound threshold set to: ${this.threshold.toFixed(4)}`);
        eventBus.emit('audio-threshold-changed', { threshold: this.threshold });
    }

    /**
     * Set the callback function to call when sound is detected
     */
    onSoundDetected(callback) {
        debug('audio', 'Setting sound detection callback via event bus');
        // Remove any previous direct callback subscription to use the event bus
        eventBus.on('sound-detected', callback);
    }

    /**
     * Update method to be called on each animation frame
     * @returns {number} Current volume level (0-1)
     */
    update() {
        if (!this.isEnabled || !this.analyserNode) return 0;

        // Get current volume from analyzer
        this.analyserNode.getByteTimeDomainData(this.dataArray);
        
        // Calculate RMS (root mean square) for better volume representation
        let sumSquares = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            // Convert from 0-255 to -1 to 1
            const amplitude = (this.dataArray[i] - 128) / 128;
            sumSquares += amplitude * amplitude;
        }
        const rms = Math.sqrt(sumSquares / this.dataArray.length);
        
        // Handle calibration if needed
        if (this.calibrating) {
            this.calibrationSamples.push(rms);
            
            if (DEBUG.calibrate && this.calibrationSamples.length % 10 === 0) {
                debug('calibrate', `Calibration progress: ${this.calibrationSamples.length}/${this.calibrationDuration}, current RMS: ${rms.toFixed(4)}`);
            }
            
            if (this.calibrationSamples.length >= this.calibrationDuration) {
                // Sort samples and take the median as baseline to avoid outliers
                const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
                const medianIndex = Math.floor(sortedSamples.length / 2);
                this.baselineVolume = sortedSamples[medianIndex];
                
                // Add a small buffer to avoid false triggers from minor noise
                this.baselineVolume += 0.01;
                
                debug('calibrate', `Microphone calibration complete. Baseline noise: ${this.baselineVolume.toFixed(4)}`);
                debug('calibrate', `Sample range: min=${sortedSamples[0].toFixed(4)}, max=${sortedSamples[sortedSamples.length-1].toFixed(4)}`);
                
                this.calibrating = false;
                
                // If we were in calibrating state, move to ready state
                if (stateMachine.getState() === AppStates.CALIBRATING) {
                    stateMachine.transition(AppStates.READY);
                }
                
                eventBus.emit('audio-calibration-completed', { 
                    baselineVolume: this.baselineVolume,
                    samples: this.calibrationSamples.length,
                    min: sortedSamples[0],
                    max: sortedSamples[sortedSamples.length-1],
                    median: this.baselineVolume
                });
            }
            
            // Emit calibration progress event
            eventBus.emit('audio-calibration-progress', { 
                progress: this.calibrationSamples.length / this.calibrationDuration,
                samples: this.calibrationSamples.length,
                total: this.calibrationDuration
            });
            
            return rms;
        }
        
        // Update volume history (for visualization)
        this.volumeHistory.shift();
        this.volumeHistory.push(rms);
        
        // Calculate volume relative to baseline noise floor
        const relativeVolume = Math.max(0, rms - this.baselineVolume);
        
        // Calculate volume change rate
        const volumeChange = relativeVolume - this.prevVolume;
        this.prevVolume = relativeVolume;
        
        // Calculate average from recent samples for smoothing
        const avgRecent = this.volumeHistory.slice(-5).reduce((sum, v) => sum + v, 0) / 5;
        this.currentVolume = avgRecent;
        
        // Log volume data at lower frequency
        if (DEBUG.volume && Math.random() < 0.05) { // Log roughly 5% of frames
            debug('volume', {
                raw: rms.toFixed(4),
                relative: relativeVolume.toFixed(4),
                change: volumeChange.toFixed(4),
                baseline: this.baselineVolume.toFixed(4),
                threshold: this.threshold.toFixed(4)
            });
        }
        
        // Emit volume update event for UI components
        eventBus.emit('volume-updated', { 
            raw: rms,
            relative: relativeVolume,
            average: avgRecent,
            history: [...this.volumeHistory]
        });
        
        const now = new Date().getTime();
        
        // Check for sounds that should trigger events
        if (now - this.lastTriggerTime > this.cooldownTime && (
            // Trigger on sharp volume changes OR sustained loud noises
            (volumeChange > this.threshold) ||
            (relativeVolume > this.threshold * 3 && volumeChange > -0.01)
        )) {
            this.lastTriggerTime = now;
            
            // Calculate intensity based on volume
            const intensity = Math.min(1, relativeVolume / (this.threshold * 5));
            
            debug('detect', `Sound detected! Intensity: ${intensity.toFixed(2)}, Volume: ${relativeVolume.toFixed(4)}, Change: ${volumeChange.toFixed(4)}, Threshold: ${this.threshold.toFixed(4)}`);
            
            // Emit sound detection event
            eventBus.emit('sound-detected', intensity);
        }
        
        return rms;
    }

    /**
     * Get current volume level for visualization
     */
    getCurrentLevel() {
        return this.currentVolume;
    }

    /**
     * Get volume history for visualization
     */
    getVolumeHistory() {
        return [...this.volumeHistory];
    }
}