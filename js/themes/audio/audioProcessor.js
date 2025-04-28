/**
 * AudioProcessor class to handle microphone input and sound detection
 */
class AudioProcessor {
    constructor() {
        this.mic = null;
        this.analyzer = null;
        this.isSetup = false;
        this.isEnabled = false;
        
        // Detection settings
        this.threshold = 0.05; // Default threshold (0-1), lowered default
        this.smoothing = 0.8; // Smoothing factor for amplitude
        this.prevVolume = 0;
        this.currentVolume = 0;
        this.volumeHistory = Array(30).fill(0); // Store recent volume history
        this.baselineVolume = 0; // Store ambient noise level
        this.calibrating = false;
        this.calibrationSamples = [];
        this.calibrationDuration = 60; // Frames to calibrate (about 2 seconds at 30fps)
        
        // Callback function for when a sound is detected
        this.onSoundDetectedCallback = null;
        
        // Cooldown to prevent too many triggers
        this.cooldownTime = 300; // ms, increased to prevent rapid triggers
        this.lastTriggerTime = 0;
    }

    /**
     * Initialize audio input
     * @returns {boolean} True if successfully initialized
     */
    async setup() {
        try {
            if (typeof p5 === 'undefined' || typeof p5.AudioIn === 'undefined') {
                console.error('p5.sound library not loaded');
                return false;
            }

            // Only set up once
            if (this.isSetup) return true;
            
            // Create audio input and analyzer
            this.mic = new p5.AudioIn();
            this.analyzer = new p5.Amplitude();
            this.analyzer.setInput(this.mic);
            this.analyzer.smooth(this.smoothing);
            
            this.isSetup = true;
            return true;
        } catch (error) {
            console.error('Error setting up audio:', error);
            return false;
        }
    }

    /**
     * Start listening to microphone input
     * @returns {Promise<boolean>} True if successfully started
     */
    async start() {
        if (!this.isSetup) {
            const setupSuccess = await this.setup();
            if (!setupSuccess) return false;
        }
        
        try {
            // Request microphone permission and start
            await this.mic.start();
            this.isEnabled = true;
            
            // Begin calibration
            this.calibrating = true;
            this.calibrationSamples = [];
            console.log("Calibrating microphone, please remain quiet...");
            
            return true;
        } catch (error) {
            console.error('Error starting microphone:', error);
            this.isEnabled = false;
            return false;
        }
    }

    /**
     * Stop listening to microphone input
     */
    stop() {
        if (this.mic && this.isEnabled) {
            this.mic.stop();
            this.isEnabled = false;
        }
    }

    /**
     * Set the sound detection threshold
     * @param {number} value - Threshold value (0-1)
     */
    setThreshold(value) {
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
        console.log(`Sound threshold set to: ${this.threshold.toFixed(4)}`);
    }

    /**
     * Set the callback function to call when sound is detected
     * @param {Function} callback - Function to call when sound is detected
     */
    onSoundDetected(callback) {
        this.onSoundDetectedCallback = callback;
    }

    /**
     * Update method to be called on each animation frame
     * @returns {number} Current volume level (0-1)
     */
    update() {
        if (!this.isEnabled || !this.mic) return 0;

        // Get current volume (0-1)
        const rawVolume = this.analyzer.getLevel();
        
        // Handle calibration if needed
        if (this.calibrating) {
            this.calibrationSamples.push(rawVolume);
            
            if (this.calibrationSamples.length >= this.calibrationDuration) {
                // Sort samples and take the median as baseline
                // This avoids outliers affecting the baseline
                const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
                const medianIndex = Math.floor(sortedSamples.length / 2);
                this.baselineVolume = sortedSamples[medianIndex];
                
                // Add a small buffer to avoid false triggers from minor noise
                this.baselineVolume += 0.01;
                
                console.log(`Microphone calibrated. Baseline noise: ${this.baselineVolume.toFixed(4)}`);
                this.calibrating = false;
            }
            
            return rawVolume;
        }
        
        // Update volume history (for visualization)
        this.volumeHistory.shift();
        this.volumeHistory.push(rawVolume);
        
        // Calculate volume relative to baseline noise floor
        const relativeVolume = Math.max(0, rawVolume - this.baselineVolume);
        
        // Calculate volume change rate
        const volumeChange = relativeVolume - this.prevVolume;
        this.prevVolume = relativeVolume;
        
        // For debugging - log significant volume
        if (relativeVolume > this.threshold * 2) {
            console.log(`Volume: ${relativeVolume.toFixed(4)}, Change: ${volumeChange.toFixed(4)}, Threshold: ${this.threshold.toFixed(4)}`);
        }
        
        // Calculate average from recent samples
        const avgRecent = this.volumeHistory.slice(-5).reduce((sum, v) => sum + v, 0) / 5;
        this.currentVolume = avgRecent;
        
        const now = new Date().getTime();
        
        // Check for sudden loud sounds using relative volume
        // Detect either sharp volume changes OR sustained loud noises
        if (now - this.lastTriggerTime > this.cooldownTime && (
            // Sharp volume change exceeding threshold
            (volumeChange > this.threshold) ||
            // OR sustained loud volume significantly above threshold
            (relativeVolume > this.threshold * 3 && volumeChange > -0.01)
        )) {
            this.lastTriggerTime = now;
            
            // Calculate intensity based on volume
            const intensity = Math.min(1, relativeVolume / (this.threshold * 5));
            
            // Call the callback if set
            if (typeof this.onSoundDetectedCallback === 'function') {
                this.onSoundDetectedCallback(intensity);
                console.log('Sound detected!', intensity.toFixed(2));
            }
        }
        
        return rawVolume;
    }

    /**
     * Get current volume level for visualization
     * @returns {number} Current volume level (0-1)
     */
    getCurrentLevel() {
        return this.currentVolume;
    }

    /**
     * Get volume history for visualization
     * @returns {Array} Array of recent volume levels
     */
    getVolumeHistory() {
        return [...this.volumeHistory];
    }
}