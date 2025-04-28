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
        
        // Permission status tracking
        this.permissionGranted = false;
    }

    /**
     * Show a custom permission prompt overlay specifically for Edge
     * This creates a visible overlay that guides the user through allowing microphone access
     */
    showPermissionPrompt() {
        const overlay = document.createElement('div');
        overlay.className = 'permission-overlay';
        overlay.innerHTML = `
            <div class="permission-box">
                <h3>Microphone Permission Required</h3>
                <p>This app needs access to your microphone to detect sounds and create snowflake bursts.</p>
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
        
        // Add button handler
        document.getElementById('request-permission-btn').addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.edgeAudioStream = stream;
                this.permissionGranted = true;
                console.log("Permission granted via custom prompt, stream active:", stream.active);
                overlay.remove();
                
                // Now that we have permission, continue with mic initialization
                this.continueWithMicrophoneStart();
            } catch (err) {
                console.error("Permission denied via custom prompt:", err);
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
                    overlay.remove();
                });
            }
        });
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
            console.log("Starting microphone in " + 
                (this.isEdge ? "Edge" : this.isChrome ? "Chrome" : this.isFirefox ? "Firefox" : "Other browser"));
            
            // Special handling for Edge - explicitly check and request permissions
            if (this.isEdge) {
                console.log("Edge detected, explicitly checking microphone permissions");
                
                // Try the Permissions API first
                try {
                    const permResult = await navigator.permissions.query({ name: 'microphone' });
                    console.log("Permission status:", permResult.state);
                    
                    if (permResult.state === 'denied') {
                        alert("Microphone access is blocked. Please click the camera/lock icon in the address bar, select 'Site permissions', and allow microphone access.");
                        return false;
                    } else if (permResult.state === 'prompt') {
                        // Show a custom permission prompt for better UX
                        this.showPermissionPrompt();
                        return true; // The actual mic start will happen after permission is granted
                    } else if (permResult.state === 'granted') {
                        this.permissionGranted = true;
                        // Permission already granted, proceed with normal flow
                    }
                } catch (err) {
                    console.warn("Could not check permissions API:", err);
                    // Force a direct permission request
                    try {
                        console.log("Explicitly requesting microphone permissions in Edge");
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        this.edgeAudioStream = stream;
                        this.permissionGranted = true;
                        console.log("Edge permission granted, stream active:", stream.active);
                    } catch (err) {
                        console.error("Microphone permission denied in Edge:", err);
                        alert("Microphone access was denied. Please click the camera/lock icon in the address bar and allow microphone access, then try again.");
                        return false;
                    }
                }
                
                if (!this.permissionGranted) {
                    // Show our custom permission UI as a fallback
                    this.showPermissionPrompt();
                    return true; // We'll handle the actual mic start after permission
                }
            }
            
            return this.continueWithMicrophoneStart();
            
        } catch (error) {
            console.error('Error starting microphone:', error);
            this.isEnabled = false;
            return false;
        }
    }
    
    /**
     * Continue with microphone initialization after permissions are handled
     * @returns {Promise<boolean>} True if successfully started
     */
    async continueWithMicrophoneStart() {
        try {
            // Edge-specific handling for better sensitivity
            if (this.isEdge) {
                // Force a lower smoothing factor for Edge to make it more responsive
                if (this.analyzer) {
                    this.analyzer.smooth(0.5); // Less smoothing means faster response to sound
                    console.log("Adjusted audio smoothing for Edge");
                }
                
                // Lower threshold for Edge to make detection more sensitive
                this.threshold = Math.max(0.01, this.threshold * 0.5);
                console.log("Adjusted detection threshold for Edge:", this.threshold);
            }
            
            // Request microphone permission and start
            await this.mic.start();
            this.isEnabled = true;
            
            // Begin calibration
            this.calibrating = true;
            this.calibrationSamples = [];
            console.log("Calibrating microphone, please remain quiet...");
            
            return true;
        } catch (error) {
            console.error('Error in continueWithMicrophoneStart:', error);
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
        
        // Edge-specific debugging - log more audio data for Edge
        if (this.isEdge && rawVolume > 0.02) { // Only log when there's actual sound
            console.log(`Edge audio level: ${rawVolume.toFixed(4)}, threshold: ${this.threshold.toFixed(4)}`);
        }
        
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
            
            // For Edge, make calibration faster
            if (this.isEdge && this.calibrationSamples.length >= Math.floor(this.calibrationDuration * 0.5)) {
                // Complete calibration even earlier in Edge (50% of normal time)
                const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
                const medianIndex = Math.floor(sortedSamples.length / 2);
                this.baselineVolume = sortedSamples[medianIndex];
                // Lower baseline for Edge to make detection more sensitive
                this.baselineVolume = Math.max(0, this.baselineVolume * 0.7);
                console.log(`Edge microphone calibrated. Baseline: ${this.baselineVolume.toFixed(4)}`);
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
        
        // Make Edge much more sensitive for sound detection
        let detectionThreshold = this.threshold;
        if (this.isEdge) {
            detectionThreshold *= 0.4; // Make Edge 60% more sensitive
            
            // For extremely loud sounds in Edge, always trigger regardless of change
            if (rawVolume > 0.2) { // If sound is very loud in Edge
                const now = new Date().getTime();
                if (now - this.lastTriggerTime > this.cooldownTime) {
                    this.lastTriggerTime = now;
                    const intensity = Math.min(1, rawVolume * 3);
                    
                    if (typeof this.onSoundDetectedCallback === 'function') {
                        this.onSoundDetectedCallback(intensity);
                        console.log('Loud sound detected in Edge!', rawVolume.toFixed(2));
                    }
                }
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