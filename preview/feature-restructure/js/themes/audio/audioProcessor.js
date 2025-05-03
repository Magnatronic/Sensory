/**
 * Audio processor for analyzing microphone input
 * Provides real-time audio analysis for visualization
 */
import { eventBus } from '../../core/event-bus.js';
import { settingsManager } from '../../core/app-config.js';

// Debug configuration
const DEBUG = {
    init: true,          // Initialization logs
    analysis: false,     // Audio analysis logs (high frequency, off by default)
    detection: true,     // Sound detection event logs
    calibration: true,   // Calibration process logs
    threshold: true,     // Threshold adjustment logs
    error: true,         // Error logs
    performance: true,   // Performance monitoring of audio processing
    events: true,        // Event emission logs
    browser: true,       // Browser compatibility information
    state: true,         // State transitions
    memory: false        // Memory usage stats (high frequency, off by default)
};

// Debug utilities
function debug(category, ...args) {
    if (DEBUG[category]) {
        const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.sss
        console.log(`%c[AudioProcessor:${category}]%c ${timestamp}`, 'color: #9c89ff; font-weight: bold', 'color: #777777', ...args);
    }
}

function logError(...args) {
    if (DEBUG.error) {
        const timestamp = new Date().toISOString().substr(11, 12);
        console.error(`%c[AudioProcessor:ERROR]%c ${timestamp}`, 'color: #ff3860; font-weight: bold', 'color: #777777', ...args);
        
        // Log stack trace if the last argument is an Error
        const lastArg = args[args.length - 1];
        if (lastArg instanceof Error && lastArg.stack) {
            console.error(`%c[Stack Trace]`, 'color: #ff3860;', lastArg.stack);
        }
    }
}

// Browser audio capability detection
function detectAudioCapabilities() {
    const capabilities = {
        AudioContext: !!(window.AudioContext || window.webkitAudioContext),
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        audioWorklet: !!(window.AudioContext && AudioContext.prototype.audioWorklet),
        permissions: !!(navigator.permissions && navigator.permissions.query),
        audioAnalyser: !!(window.AudioContext && AudioContext.prototype.createAnalyser),
        supportsSampleRate96kHz: false,
        browser: {
            name: getBrowserName(),
            version: getBrowserVersion(),
            os: getOperatingSystem()
        }
    };
    
    // Test if high sample rates are supported
    if (capabilities.AudioContext) {
        try {
            const testContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 96000
            });
            capabilities.supportsSampleRate96kHz = testContext.sampleRate === 96000;
            testContext.close().catch(() => {});
        } catch (e) {
            // High sample rate not supported
        }
    }
    
    debug('browser', 'Audio capabilities detected:', capabilities);
    return capabilities;
}

// Browser detection helpers
function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.indexOf("Edge") > -1) return "Edge";
    if (ua.indexOf("Edg/") > -1) return "Edge Chromium";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("MSIE") > -1 || ua.indexOf("Trident") > -1) return "IE";
    return "Unknown";
}

function getBrowserVersion() {
    const ua = navigator.userAgent;
    let match = ua.match(/(Edge|Edg|Chrome|Safari|Firefox|MSIE|Trident)\/?\s*(\d+)/i);
    if (!match) return "Unknown";
    let version = match[2];
    return version || "Unknown";
}

function getOperatingSystem() {
    const ua = navigator.userAgent;
    if (ua.indexOf("Win") > -1) return "Windows";
    if (ua.indexOf("Mac") > -1) return "MacOS";
    if (ua.indexOf("Linux") > -1) return "Linux";
    if (ua.indexOf("Android") > -1) return "Android";
    if (ua.indexOf("iOS") > -1 || 
        (ua.indexOf("Mac") > -1 && navigator.maxTouchPoints > 0)) return "iOS";
    return "Unknown";
}

class AudioProcessor {
    constructor() {
        // Audio context and nodes
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isInitialized = false;
        this.isRunning = false;
        
        // Analysis buffers and parameters
        this.frequencyData = null;
        this.timeDomainData = null;
        this.fftSize = 2048;
        this.smoothingTimeConstant = 0.8;
        
        // Detection settings
        this.detectionSettings = {
            threshold: settingsManager.get('audio.threshold', 0.1),
            minValue: settingsManager.get('audio.minValue', 0.0),
            maxValue: settingsManager.get('audio.maxValue', 1.0),
            cooldownMs: settingsManager.get('audio.cooldownMs', 50),
            sensitivityMultiplier: settingsManager.get('audio.sensitivity', 1.0),
            autoThreshold: settingsManager.get('audio.autoThreshold', true),
            autoThresholdTarget: settingsManager.get('audio.autoThresholdTarget', 0.2)
        };
        
        // Detection state
        this.lastDetectionTime = 0;
        this.isInCooldown = false;
        this.baselineNoiseLevel = 0;
        this.calibrationSamples = [];
        this.calibrationInProgress = false;
        
        // Performance monitoring
        this.performanceMetrics = {
            analysisTimeAvg: 0,
            analysisTimeSamples: [],
            sampleCount: 0,
            detectionCount: 0,
            lastReportTime: 0,
            volumeHistory: [],    // Added for volume trend analysis
            peakVolume: 0,        // Track peak volume for calibration reference
            detectionHistory: [], // Timestamps of last 50 detections
            missedFrames: 0,      // Track frames where analysis took too long
            memoryUsage: {        // Track memory usage
                lastCheck: 0,
                jsHeapSizeLimit: 0,
                totalJSHeapSize: 0,
                usedJSHeapSize: 0,
                samplesCount: 0
            }
        };
        
        // Browser capabilities
        this.browserCapabilities = detectAudioCapabilities();
        
        // Settings change handler
        this.setupEventListeners();
        
        debug('init', 'Audio processor created with settings:', this.detectionSettings);
        debug('init', `Running on ${this.browserCapabilities.browser.name} ${this.browserCapabilities.browser.version} (${this.browserCapabilities.browser.os})`);
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for settings changes
        eventBus.on('settings-changed', (data) => {
            if (data.key.startsWith('audio.')) {
                const setting = data.key.replace('audio.', '');
                if (setting in this.detectionSettings) {
                    debug('threshold', `Setting ${setting} changed: ${data.value}`);
                    this.detectionSettings[setting] = data.value;
                }
            }
        });
        
        // Listen for calibration requests
        eventBus.on('audio-calibrate-request', () => {
            debug('calibration', 'Calibration requested');
            this.startCalibration();
        });
        
        // Listen for threshold adjustment
        eventBus.on('audio-threshold-adjust', (data) => {
            debug('threshold', `Manual threshold adjustment: ${data.value}`);
            this.detectionSettings.threshold = data.value;
            settingsManager.set('audio.threshold', data.value);
            eventBus.emit('audio-threshold-changed', { threshold: data.value });
        });
        
        // Debug: Log when certain debug flags change
        eventBus.on('audio-debug-flags-changed', (flags) => {
            for (const flag in flags) {
                if (DEBUG[flag] !== undefined) {
                    DEBUG[flag] = flags[flag];
                    debug('init', `Debug flag ${flag} set to ${flags[flag]}`);
                }
            }
        });
        
        // Listen for memory check requests
        eventBus.on('request-memory-stats', () => {
            this.checkMemoryUsage(true);
        });
        
        debug('init', 'Event listeners registered');
    }
    
    /**
     * Initialize the audio processor
     */
    async initialize() {
        if (this.isInitialized) {
            debug('init', 'Audio processor already initialized');
            return true;
        }
        
        debug('init', 'Initializing audio processor');
        
        try {
            // Check permissions first - this can be useful for debugging
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    debug('init', 'Checking microphone permission status...');
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                    debug('init', `Microphone permission status: ${permissionStatus.state}`);
                    
                    // Add listener for permission changes
                    permissionStatus.addEventListener('change', () => {
                        debug('state', `Microphone permission changed to: ${permissionStatus.state}`);
                        eventBus.emit('microphone-permission-changed', { state: permissionStatus.state });
                    });
                } catch (err) {
                    debug('init', 'Permission query not supported or failed:', err);
                }
            }
            
            // Create audio context
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            
            debug('init', `Audio context created, sample rate: ${this.audioContext.sampleRate}Hz, state: ${this.audioContext.state}`);
            
            // Add audio context state change listener
            this.audioContext.addEventListener('statechange', () => {
                debug('state', `Audio context state changed to: ${this.audioContext.state}`);
                eventBus.emit('audio-context-state-changed', { state: this.audioContext.state });
                
                // If resumed automatically, note this
                if (this.audioContext.state === 'running' && !this.isRunning) {
                    debug('state', 'Audio context running but processor not marked as running');
                }
            });
            
            // Set up analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            
            debug('init', `Analyser created with: 
                - fftSize: ${this.analyser.fftSize}
                - frequencyBinCount: ${this.analyser.frequencyBinCount}
                - smoothingTimeConstant: ${this.analyser.smoothingTimeConstant}
                - minDecibels: ${this.analyser.minDecibels}
                - maxDecibels: ${this.analyser.maxDecibels}`
            );
            
            // Create data buffers
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Uint8Array(this.analyser.fftSize);
            
            debug('init', `Data buffers created:
                - Frequency data: ${this.frequencyData.length} samples
                - Time domain data: ${this.timeDomainData.length} samples`
            );
            
            // Successfully initialized but not yet capturing
            this.isInitialized = true;
            
            // Emit event
            const initData = {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state,
                analyserConfig: {
                    fftSize: this.analyser.fftSize,
                    frequencyBinCount: this.analyser.frequencyBinCount,
                    smoothingTimeConstant: this.analyser.smoothingTimeConstant
                }
            };
            
            debug('events', 'Emitting audio-processor-initialized event', initData);
            eventBus.emit('audio-processor-initialized', initData);
            
            debug('init', 'Audio processor initialized successfully');
            return true;
        } catch (error) {
            logError('Failed to initialize audio processor:', error);
            
            // Log detailed errors for specific cases
            if (error.name === 'NotSupportedError') {
                logError('The audio API is not supported in this browser');
            } else if (error.name === 'AbortError') {
                logError('Audio context creation was aborted');
            } else if (error.name === 'SecurityError') {
                logError('Security error initializing audio - possible cross-origin issue');
            }
            
            const errorData = { 
                type: 'initialization', 
                name: error.name,
                message: error.message,
                error 
            };
            
            debug('events', 'Emitting audio-processor-error event', errorData);
            eventBus.emit('audio-processor-error', errorData);
            return false;
        }
    }
    
    /**
     * Start capturing audio from the microphone
     */
    async startCapture() {
        // Make sure we're initialized
        if (!this.isInitialized) {
            debug('state', 'Not initialized, attempting initialization first');
            const initialized = await this.initialize();
            if (!initialized) {
                logError('Cannot start capture, initialization failed');
                return false;
            }
        }
        
        // Don't start if already running
        if (this.isRunning) {
            debug('init', 'Audio capture already running');
            return true;
        }
        
        debug('init', 'Starting audio capture');
        
        try {
            // If audio context was suspended (like from autoplay policy), resume it
            if (this.audioContext.state === 'suspended') {
                debug('state', 'Audio context is suspended, attempting to resume...');
                await this.audioContext.resume();
                debug('state', `Audio context resumed, new state: ${this.audioContext.state}`);
            }
            
            // Get microphone access with detailed constraints
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };
            
            debug('init', 'Requesting microphone access with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Log the tracks in the stream (useful for debugging)
            const tracks = stream.getAudioTracks();
            debug('init', `Got ${tracks.length} audio tracks`);
            
            // Log details of first track if available
            if (tracks.length > 0) {
                const settings = tracks[0].getSettings();
                const capabilities = tracks[0].getCapabilities ? tracks[0].getCapabilities() : 'Not supported';
                debug('init', 'Audio track settings:', settings);
                debug('init', 'Audio track capabilities:', capabilities);
            }
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            debug('init', 'Microphone connected to analyser');
            
            // Start the analysis loop
            this.isRunning = true;
            this.analyse();
            
            // Reset performance metrics 
            this.resetPerformanceMetrics();
            
            // Emit event
            debug('events', 'Emitting audio-capture-started event');
            eventBus.emit('audio-capture-started', { 
                timestamp: Date.now(),
                tracks: tracks.length,
                context: {
                    sampleRate: this.audioContext.sampleRate,
                    state: this.audioContext.state
                }
            });
            
            // If auto threshold is enabled, start calibration
            if (this.detectionSettings.autoThreshold) {
                debug('threshold', 'Auto threshold enabled, starting calibration');
                setTimeout(() => this.startCalibration(), 500); // Short delay to let levels settle
            }
            
            return true;
        } catch (error) {
            logError('Failed to start audio capture:', error);
            
            // Special case handling for common errors
            let errorType = 'capture';
            let errorDetails = {};
            
            if (error.name === 'NotAllowedError') {
                errorType = 'permission-denied';
                debug('state', 'Microphone permission denied');
                errorDetails = { permissionDenied: true };
            } else if (error.name === 'NotFoundError') {
                errorType = 'no-microphone';
                debug('state', 'No microphone found');
                errorDetails = { noMicrophoneFound: true };
            } else if (error.name === 'AbortError') {
                errorType = 'aborted';
                debug('state', 'Microphone request aborted');
            }
            
            const errorData = { 
                type: errorType, 
                name: error.name,
                message: error.message,
                ...errorDetails,
                error
            };
            
            debug('events', 'Emitting audio-processor-error event', errorData);
            eventBus.emit('audio-processor-error', errorData);
            return false;
        }
    }
    
    /**
     * Stop audio capture
     */
    stopCapture() {
        if (!this.isRunning) {
            debug('init', 'Audio capture already stopped');
            return;
        }
        
        debug('init', 'Stopping audio capture');
        debug('performance', 'Final performance metrics:', this.getPerformanceMetrics());
        
        try {
            // Disconnect microphone
            if (this.microphone) {
                debug('init', 'Disconnecting microphone');
                this.microphone.disconnect();
                this.microphone = null;
            }
            
            // Stop running
            this.isRunning = false;
            
            // Emit event with performance stats
            const perfMetrics = this.getPerformanceMetrics();
            debug('events', 'Emitting audio-capture-stopped event', perfMetrics);
            eventBus.emit('audio-capture-stopped', {
                timestamp: Date.now(),
                performanceMetrics: perfMetrics
            });
            
            debug('init', 'Audio capture stopped');
        } catch (error) {
            logError('Error stopping audio capture:', error);
        }
    }
    
    /**
     * Main analysis loop
     */
    analyse() {
        if (!this.isRunning) return;
        
        // Track analysis performance
        const startTime = performance.now();
        
        try {
            // Get audio data
            this.analyser.getByteFrequencyData(this.frequencyData);
            this.analyser.getByteTimeDomainData(this.timeDomainData);
            
            // Calculate current volume level (RMS of time domain data)
            const volume = this.calculateRMSLevel();
            
            // Normalize volume to 0-1 range
            const normalizedVolume = this.normalizeVolume(volume);
            
            // Add to volume history
            this.updateVolumeHistory(normalizedVolume);
            
            // Extremely throttled logging to avoid console spam
            if (DEBUG.analysis && Math.random() < 0.01) { // Log ~1% of analyses
                debug('analysis', `Volume: ${normalizedVolume.toFixed(4)}, Threshold: ${this.detectionSettings.threshold.toFixed(4)}`);
                
                // Log frequency data highs
                if (this.frequencyData) {
                    const highestBins = this.getHighestFrequencyBins(5);
                    debug('analysis', 'Top frequency bins:', highestBins);
                }
            }
            
            // Check if we should detect a sound
            this.detectSound(normalizedVolume);
            
            // Update performance metrics
            const analysisTime = performance.now() - startTime;
            this.updatePerformanceMetrics(analysisTime);
            
            // Check for performance issues
            if (analysisTime > 16.67) { // Over 60fps frame budget
                this.performanceMetrics.missedFrames++;
                
                if (this.performanceMetrics.missedFrames % 60 === 0) { // Log every 60 missed frames
                    debug('performance', `Warning: Analysis taking too long (${analysisTime.toFixed(2)}ms), ${this.performanceMetrics.missedFrames} missed frames`);
                }
            }
            
            // Check memory usage periodically
            this.checkMemoryUsage();
            
            // Schedule next analysis
            requestAnimationFrame(() => this.analyse());
        } catch (error) {
            logError('Error in audio analysis loop:', error);
            this.isRunning = false;
            
            const errorData = { 
                type: 'analysis', 
                context: 'analysis-loop',
                message: error.message,
                error
            };
            
            debug('events', 'Emitting audio-processor-error event', errorData);
            eventBus.emit('audio-processor-error', errorData);
        }
    }
    
    /**
     * Calculate RMS level from time domain data
     */
    calculateRMSLevel() {
        // Calculate RMS of the signal
        let sumOfSquares = 0;
        const length = this.timeDomainData.length;
        
        for (let i = 0; i < length; i++) {
            // Convert from 0-255 to -1.0 to 1.0
            const audioSample = (this.timeDomainData[i] - 128) / 128;
            sumOfSquares += audioSample * audioSample;
        }
        
        return Math.sqrt(sumOfSquares / length);
    }
    
    /**
     * Get highest frequency bins for debugging
     */
    getHighestFrequencyBins(count) {
        if (!this.frequencyData || !this.analyser) return [];
        
        // Create array of [bin index, value] pairs
        const pairs = Array.from(this.frequencyData).map((val, idx) => [idx, val]);
        
        // Sort by value descending
        pairs.sort((a, b) => b[1] - a[1]);
        
        // Take top count and convert to frequency
        return pairs.slice(0, count).map(([binIndex, value]) => {
            const frequency = binIndex * this.audioContext.sampleRate / (this.analyser.fftSize * 2);
            return {
                bin: binIndex,
                value,
                frequency: Math.round(frequency),
                normalized: value / 255
            };
        });
    }
    
    /**
     * Normalize volume level to 0-1 range with sensitivity
     */
    normalizeVolume(volume) {
        // Apply min/max bounds
        const { minValue, maxValue, sensitivityMultiplier } = this.detectionSettings;
        
        // Clamp to min/max
        let normalizedVolume = Math.max(0, Math.min(1, (volume - minValue) / (maxValue - minValue)));
        
        // Apply sensitivity multiplier
        normalizedVolume = Math.min(1, normalizedVolume * sensitivityMultiplier);
        
        return normalizedVolume;
    }
    
    /**
     * Update volume history for trending
     */
    updateVolumeHistory(volume) {
        // Keep 100 most recent volume samples
        this.performanceMetrics.volumeHistory.push(volume);
        if (this.performanceMetrics.volumeHistory.length > 100) {
            this.performanceMetrics.volumeHistory.shift();
        }
        
        // Update peak volume
        if (volume > this.performanceMetrics.peakVolume) {
            this.performanceMetrics.peakVolume = volume;
        }
    }
    
    /**
     * Check if we should emit a sound detection event
     */
    detectSound(volume) {
        // Check for cooldown
        const now = performance.now();
        if (this.isInCooldown && now - this.lastDetectionTime < this.detectionSettings.cooldownMs) {
            return;
        }
        
        // No longer in cooldown
        this.isInCooldown = false;
        
        // If we're calibrating, collect samples
        if (this.calibrationInProgress) {
            this.calibrationSamples.push(volume);
            return;
        }
        
        // Check if volume exceeds threshold
        if (volume > this.detectionSettings.threshold) {
            if (DEBUG.detection) {
                debug('detection', `Sound detected! Volume: ${volume.toFixed(4)}, Threshold: ${this.detectionSettings.threshold.toFixed(4)}`);
            }
            
            // Enter cooldown
            this.lastDetectionTime = now;
            this.isInCooldown = true;
            
            // Track detection count and history
            this.performanceMetrics.detectionCount++;
            this.performanceMetrics.detectionHistory.push({
                timestamp: now,
                volume: volume,
                threshold: this.detectionSettings.threshold
            });
            
            // Keep only recent detection history
            if (this.performanceMetrics.detectionHistory.length > 50) {
                this.performanceMetrics.detectionHistory.shift();
            }
            
            // Emit detection event with normalized intensity
            // Intensity is how much it exceeds the threshold, normalized to 0-1
            // (with 1 being double the threshold or more)
            const exceedFactor = (volume - this.detectionSettings.threshold) / this.detectionSettings.threshold;
            const intensity = Math.min(1, exceedFactor);
            
            debug('events', `Emitting sound-detected event with intensity ${intensity.toFixed(2)}`);
            eventBus.emit('sound-detected', intensity);
        }
    }
    
    /**
     * Start the calibration process
     */
    startCalibration() {
        if (this.calibrationInProgress) {
            debug('calibration', 'Calibration already in progress');
            return;
        }
        
        debug('calibration', 'Starting calibration process');
        
        // Reset calibration samples
        this.calibrationSamples = [];
        this.calibrationInProgress = true;
        
        // Reset peak volume for this calibration session
        this.performanceMetrics.peakVolume = 0;
        
        // Emit calibration start event
        debug('events', 'Emitting audio-calibration-started event');
        eventBus.emit('audio-calibration-started');
        
        // Run calibration for 2 seconds
        setTimeout(() => this.finishCalibration(), 2000);
    }
    
    /**
     * Finish calibration and set new threshold
     */
    finishCalibration() {
        if (!this.calibrationInProgress) return;
        
        debug('calibration', `Finishing calibration with ${this.calibrationSamples.length} samples`);
        
        this.calibrationInProgress = false;
        
        // Calculate new threshold from samples
        if (this.calibrationSamples.length > 0) {
            // Generate stats about samples for debugging
            const minSample = Math.min(...this.calibrationSamples);
            const maxSample = Math.max(...this.calibrationSamples);
            const avgSample = this.calibrationSamples.reduce((sum, val) => sum + val, 0) / this.calibrationSamples.length;
            
            debug('calibration', `Calibration samples stats: min=${minSample.toFixed(4)}, max=${maxSample.toFixed(4)}, avg=${avgSample.toFixed(4)}`);
            
            // Sort samples and pick the value at 75th percentile for noise baseline
            const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
            const p75Index = Math.floor(sortedSamples.length * 0.75);
            this.baselineNoiseLevel = sortedSamples[p75Index];
            
            // Set threshold to be slightly above baseline
            const targetThreshold = this.baselineNoiseLevel * (1 + this.detectionSettings.autoThresholdTarget);
            this.detectionSettings.threshold = Math.max(0.05, Math.min(0.5, targetThreshold));
            
            debug('calibration', `New baseline noise level: ${this.baselineNoiseLevel.toFixed(4)}`);
            debug('calibration', `New threshold set to: ${this.detectionSettings.threshold.toFixed(4)}`);
            
            // Save to settings
            settingsManager.set('audio.threshold', this.detectionSettings.threshold);
            
            // Log histogram of samples (useful for understanding the distribution)
            this.logVolumeHistogram(sortedSamples);
            
            // Emit threshold changed event
            const thresholdData = { 
                threshold: this.detectionSettings.threshold,
                baselineNoise: this.baselineNoiseLevel,
                calibrationSamples: this.calibrationSamples.length,
                sampleStats: {
                    min: minSample,
                    max: maxSample,
                    avg: avgSample,
                    p25: sortedSamples[Math.floor(sortedSamples.length * 0.25)],
                    p50: sortedSamples[Math.floor(sortedSamples.length * 0.5)],
                    p75: sortedSamples[Math.floor(sortedSamples.length * 0.75)],
                    p90: sortedSamples[Math.floor(sortedSamples.length * 0.9)]
                }
            };
            
            debug('events', 'Emitting audio-threshold-changed event', thresholdData);
            eventBus.emit('audio-threshold-changed', thresholdData);
        } else {
            logError('Calibration failed - no samples collected');
            eventBus.emit('audio-calibration-failed', { reason: 'No samples collected' });
        }
        
        // Emit calibration complete event
        debug('events', 'Emitting audio-calibration-completed event');
        eventBus.emit('audio-calibration-completed');
    }
    
    /**
     * Log a histogram of volume samples for debugging
     */
    logVolumeHistogram(samples) {
        if (!DEBUG.calibration) return;
        
        const bins = 10;
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const range = max - min;
        const histogram = Array(bins).fill(0);
        
        // Count samples in each bin
        samples.forEach(sample => {
            const binIndex = Math.min(bins - 1, Math.floor(((sample - min) / range) * bins));
            histogram[binIndex]++;
        });
        
        // Calculate bin boundaries
        const binBoundaries = Array(bins).fill(0).map((_, i) => 
            (min + (range * i / bins)).toFixed(4)
        );
        
        debug('calibration', 'Volume histogram:', 
            histogram.map((count, i) => `${binBoundaries[i]}: ${'█'.repeat(Math.ceil(count / samples.length * 50))} (${count})`).join('\n')
        );
    }
    
    /**
     * Reset performance metrics
     */
    resetPerformanceMetrics() {
        this.performanceMetrics = {
            analysisTimeAvg: 0,
            analysisTimeSamples: [],
            sampleCount: 0,
            detectionCount: 0,
            lastReportTime: performance.now(),
            volumeHistory: [],
            peakVolume: 0,
            detectionHistory: [],
            missedFrames: 0,
            memoryUsage: {
                lastCheck: 0,
                jsHeapSizeLimit: 0,
                totalJSHeapSize: 0,
                usedJSHeapSize: 0,
                samplesCount: 0
            }
        };
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(analysisTime) {
        // Add analysis time to samples
        this.performanceMetrics.analysisTimeSamples.push(analysisTime);
        if (this.performanceMetrics.analysisTimeSamples.length > 100) {
            this.performanceMetrics.analysisTimeSamples.shift();
        }
        
        // Update average
        const sum = this.performanceMetrics.analysisTimeSamples.reduce((a, b) => a + b, 0);
        this.performanceMetrics.analysisTimeAvg = sum / this.performanceMetrics.analysisTimeSamples.length;
        
        // Count samples
        this.performanceMetrics.sampleCount++;
        
        // Log metrics periodically
        const now = performance.now();
        if (DEBUG.performance && now - this.performanceMetrics.lastReportTime > 5000) {
            this.performanceMetrics.lastReportTime = now;
            
            // Calculate detection rate (per second)
            const detectionRate = this.performanceMetrics.detectionCount / 5;
            
            // Calculate volume metrics
            const volumeHistory = this.performanceMetrics.volumeHistory;
            const avgVolume = volumeHistory.length > 0 ? 
                volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length : 0;
            
            const perfData = {
                avgAnalysisTime: `${this.performanceMetrics.analysisTimeAvg.toFixed(2)}ms`,
                detectionRate: `${detectionRate.toFixed(2)} detections/sec`,
                totalSamples: this.performanceMetrics.sampleCount,
                totalDetections: this.performanceMetrics.detectionCount,
                missedFrames: this.performanceMetrics.missedFrames,
                volumeStats: {
                    avg: avgVolume.toFixed(4),
                    peak: this.performanceMetrics.peakVolume.toFixed(4),
                    current: volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1].toFixed(4) : 0,
                    threshold: this.detectionSettings.threshold.toFixed(4)
                }
            };
            
            debug('performance', perfData);
            
            // Reset counters for rate calculation
            this.performanceMetrics.detectionCount = 0;
        }
    }
    
    /**
     * Check memory usage
     */
    checkMemoryUsage(forceLog = false) {
        // Skip if memory debugging is disabled and not forced
        if (!DEBUG.memory && !forceLog) return;
        
        // Only check every 5 seconds unless forced
        const now = performance.now();
        if (!forceLog && now - this.performanceMetrics.memoryUsage.lastCheck < 5000) return;
        
        this.performanceMetrics.memoryUsage.lastCheck = now;
        
        // Check if performance.memory is available (Chrome only)
        if (performance.memory) {
            const memory = performance.memory;
            this.performanceMetrics.memoryUsage.jsHeapSizeLimit = memory.jsHeapSizeLimit;
            this.performanceMetrics.memoryUsage.totalJSHeapSize = memory.totalJSHeapSize;
            this.performanceMetrics.memoryUsage.usedJSHeapSize = memory.usedJSHeapSize;
            this.performanceMetrics.memoryUsage.samplesCount++;
            
            // Calculate memory usage percentage
            const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(1);
            
            if (forceLog || DEBUG.memory) {
                debug('memory', `Memory usage: ${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB / ${(memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB (${usagePercent}%)`);
            }
            
            // Emit event if memory usage is high (>80%)
            if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
                debug('memory', 'Warning: High memory usage detected');
                eventBus.emit('high-memory-usage', {
                    usedMB: memory.usedJSHeapSize / 1048576,
                    limitMB: memory.jsHeapSizeLimit / 1048576,
                    percentage: parseFloat(usagePercent)
                });
            }
        }
    }
    
    /**
     * Get comprehensive performance metrics
     */
    getPerformanceMetrics() {
        // Calculate stats on volume history
        const volumeHistory = this.performanceMetrics.volumeHistory;
        const avgVolume = volumeHistory.length > 0 ? 
            volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length : 0;
        
        // Calculate stats on analysis time
        const analysisTimeSamples = this.performanceMetrics.analysisTimeSamples;
        const minAnalysisTime = analysisTimeSamples.length > 0 ? Math.min(...analysisTimeSamples) : 0;
        const maxAnalysisTime = analysisTimeSamples.length > 0 ? Math.max(...analysisTimeSamples) : 0;
        
        return {
            analysisTime: {
                avg: this.performanceMetrics.analysisTimeAvg,
                min: minAnalysisTime,
                max: maxAnalysisTime
            },
            sampleCount: this.performanceMetrics.sampleCount,
            detectionCount: this.performanceMetrics.detectionCount,
            missedFrames: this.performanceMetrics.missedFrames,
            missedFramesPercent: (this.performanceMetrics.missedFrames / this.performanceMetrics.sampleCount * 100).toFixed(2),
            volumeStats: {
                avg: avgVolume,
                peak: this.performanceMetrics.peakVolume,
                current: volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : 0
            },
            detection: {
                threshold: this.detectionSettings.threshold,
                baselineNoise: this.baselineNoiseLevel,
                lastDetection: this.lastDetectionTime,
                recentDetections: this.performanceMetrics.detectionHistory.length
            },
            memory: this.performanceMetrics.memoryUsage
        };
    }
    
    /**
     * Get frequency data for visualization
     */
    getFrequencyData() {
        return this.frequencyData ? [...this.frequencyData] : null;
    }
    
    /**
     * Get time domain data for visualization
     */
    getTimeDomainData() {
        return this.timeDomainData ? [...this.timeDomainData] : null;
    }
    
    /**
     * Set the detection threshold manually
     */
    setThreshold(value) {
        debug('threshold', `Setting threshold manually to ${value}`);
        this.detectionSettings.threshold = Math.max(0, Math.min(1, value));
        settingsManager.set('audio.threshold', value);
        eventBus.emit('audio-threshold-changed', { threshold: value });
    }
    
    /**
     * Set the sensitivity multiplier
     */
    setSensitivity(value) {
        debug('threshold', `Setting sensitivity multiplier to ${value}`);
        this.detectionSettings.sensitivityMultiplier = Math.max(0.1, Math.min(5, value));
        settingsManager.set('audio.sensitivity', value);
    }
    
    /**
     * Toggle auto threshold
     */
    setAutoThreshold(enabled) {
        debug('threshold', `Setting auto threshold to ${enabled}`);
        this.detectionSettings.autoThreshold = enabled;
        settingsManager.set('audio.autoThreshold', enabled);
        
        // If enabling, start calibration
        if (enabled && this.isRunning) {
            setTimeout(() => this.startCalibration(), 500);
        }
    }
    
    /**
     * Get current audio processor state for debugging
     */
    getDebugState() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            audioContext: {
                sampleRate: this.audioContext ? this.audioContext.sampleRate : null,
                state: this.audioContext ? this.audioContext.state : null
            },
            detection: { ...this.detectionSettings },
            calibration: {
                inProgress: this.calibrationInProgress,
                baselineNoiseLevel: this.baselineNoiseLevel,
                sampleCount: this.calibrationSamples.length
            },
            performance: this.getPerformanceMetrics(),
            debugFlags: { ...DEBUG },
            browser: this.browserCapabilities
        };
    }
    
    /**
     * Set a debug flag
     */
    setDebugFlag(category, value) {
        if (category in DEBUG) {
            debug('init', `Setting debug flag ${category} to ${value}`);
            DEBUG[category] = value;
            return true;
        }
        return false;
    }
}

// Export a singleton instance
export const audioProcessor = new AudioProcessor();