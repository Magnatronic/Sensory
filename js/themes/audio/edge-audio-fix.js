/**
 * Edge-specific audio implementation
 * This uses the native Web Audio API directly instead of p5.sound
 * which has compatibility issues in Microsoft Edge
 */
class EdgeAudioProcessor {
    constructor() {
        this.isEnabled = false;
        this.audioContext = null;
        this.microphoneStream = null;
        this.analyser = null;
        this.dataArray = null;
        this.volume = 0;
        this.baselineVolume = 0;
        this.threshold = 0.05;
        this.prevVolume = 0;
        this.callbackFunction = null;
        this.cooldownTime = 300; // ms
        this.lastTriggerTime = 0;
        this.isCalibrating = false;
        this.calibrationSamples = [];
        this.calibrationDuration = 30; // frames
        this.processInterval = null;
        
        console.log("EdgeAudioProcessor created - bypassing p5.sound for Microsoft Edge");
    }
    
    /**
     * Request microphone permission and set up audio context
     */
    async start() {
        try {
            console.log("EdgeAudioProcessor: Starting direct Web Audio implementation");
            
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphoneStream = stream;
            
            // Create analyzer
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 1024;
            this.analyser.smoothingTimeConstant = 0.5; // Less smoothing for more responsive detection
            
            // Connect microphone to analyzer
            const microphone = this.audioContext.createMediaStreamSource(stream);
            microphone.connect(this.analyser);
            
            // Create buffer for analysis
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Start processing audio
            this.isEnabled = true;
            this.isCalibrating = true;
            this.calibrationSamples = [];
            console.log("EdgeAudioProcessor: Calibrating microphone, please remain quiet...");
            
            // Start continuous processing
            this.processInterval = setInterval(() => this.processAudio(), 30);
            
            return true;
        } catch (error) {
            console.error("EdgeAudioProcessor Error:", error);
            return false;
        }
    }
    
    /**
     * Stop audio processing
     */
    stop() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
        
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.isEnabled = false;
        console.log("EdgeAudioProcessor: Audio processing stopped");
    }
    
    /**
     * Process audio data
     */
    processAudio() {
        if (!this.isEnabled || !this.analyser) return;
        
        // Get audio data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate volume (average of frequency data)
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        
        // Normalize volume to 0-1 range
        const rawVolume = sum / (this.dataArray.length * 255);
        this.volume = rawVolume;
        
        // Log periodically (not every frame to avoid console spam)
        if (Math.random() < 0.02) {
            console.log(`EdgeAudioProcessor: Level: ${rawVolume.toFixed(4)}, threshold: ${this.threshold.toFixed(4)}`);
        }
        
        // Handle calibration
        if (this.isCalibrating) {
            this.calibrationSamples.push(rawVolume);
            
            if (this.calibrationSamples.length >= this.calibrationDuration) {
                // Sort samples and take the median as baseline
                const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
                const medianIndex = Math.floor(sortedSamples.length / 2);
                this.baselineVolume = sortedSamples[medianIndex];
                
                // Add a small buffer
                this.baselineVolume += 0.01;
                
                console.log(`EdgeAudioProcessor: Calibrated. Baseline: ${this.baselineVolume.toFixed(4)}`);
                this.isCalibrating = false;
            }
            
            return;
        }
        
        // Calculate volume relative to baseline
        const relativeVolume = Math.max(0, rawVolume - this.baselineVolume);
        
        // Calculate volume change
        const volumeChange = relativeVolume - this.prevVolume;
        this.prevVolume = relativeVolume;
        
        // Make Edge extremely sensitive to detect claps
        const now = Date.now();
        
        // ENHANCED CLAP DETECTION FOR EDGE
        // Check for ANY notable sound above the very quiet baseline
        if (now - this.lastTriggerTime > this.cooldownTime) {
            // Just check for any sound above baseline * 4
            const threshold = Math.max(0.02, this.baselineVolume * 4);
            
            if (relativeVolume > threshold) {
                if (relativeVolume > 0.01) {  // Only log significant sounds
                    console.log(`EdgeAudioProcessor: Sound detected! Volume: ${rawVolume.toFixed(4)}, Rel: ${relativeVolume.toFixed(4)}`);
                }
                
                // Trigger if it's a significant sound
                if (relativeVolume > 0.03) {
                    this.lastTriggerTime = now;
                    const intensity = Math.min(1, relativeVolume * 5);
                    
                    // ONLY use direct connection to ThemeManager - no more callback path
                    if (window.themeManager) {
                        console.log(`EdgeAudioProcessor: Sound triggered with intensity ${intensity.toFixed(2)}`);
                        window.themeManager.onSoundDetected(intensity);
                    } else {
                        console.error("EdgeAudioProcessor: ThemeManager not available globally. Sound detection failed.");
                        // We're no longer using the callback as a fallback to avoid double-triggering
                    }
                }
            }
        }
    }
    
    /**
     * Set the threshold for sound detection
     */
    setThreshold(value) {
        // Make Edge much more sensitive regardless of slider position
        this.threshold = value * 0.5;
        console.log(`EdgeAudioProcessor: Threshold set to ${this.threshold.toFixed(4)}`);
    }
    
    /**
     * Set the callback function for sound detection
     */
    onSoundDetected(callback) {
        this.callbackFunction = callback;
    }
    
    /**
     * Get current volume level
     */
    getCurrentLevel() {
        return this.volume;
    }
}