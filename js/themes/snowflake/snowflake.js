/**
 * A single Snowflake object
 */
class Snowflake {
    constructor(canvas, initialDistribution = false, sizeMultiplier = 1) {
        this.canvas = canvas;
        this.x = this.canvas.random(0, this.canvas.width);
        // For initial setup, distribute snowflakes throughout the entire canvas height
        // This prevents the wave effect by having snowflakes at various heights
        if (initialDistribution) {
            this.y = this.canvas.random(-100, this.canvas.height);
        } else {
            this.y = this.canvas.random(-100, -10);
        }
        
        // For temporary size adjustments from audio
        this.baseSize = this.canvas.random(3, 10);
        this.size = this.baseSize * sizeMultiplier;
        this.normalSize = this.size;
        this.temporarySizeFactor = 1.0;
        
        // Store base speed for later adjustments
        this.baseSpeed = this.canvas.map(this.baseSize, 3, 10, 1, 3);
        this.speedMultiplier = 1;
        this.speed = this.baseSpeed * this.speedMultiplier;
        
        this.opacity = this.canvas.map(this.baseSize, 3, 10, 150, 255);
        
        // Wobble properties with base randomness - increased range for more visible effect
        this.baseWobbleAmount = this.canvas.random(0.8, 2.0); // Increased from (0.3, 1.0)
        this.wobbleIntensity = 1.0; // Default multiplier
        this.wobble = this.canvas.random(0, this.canvas.TWO_PI); // Random starting phase
        this.baseWobbleSpeed = this.canvas.random(0.01, 0.05);
        this.wobbleSpeed = this.baseWobbleSpeed;
        
        // Wind properties
        this.windStrength = 0;
        this.windDirection = 0; // Degrees (0 is right, 90 is down)
        
        // Default snowflake color (white)
        this.color = { r: 255, g: 255, b: 255 };
        
        // Rotation for rendering
        this.rotation = this.canvas.random(0, this.canvas.TWO_PI);
        this.rotationSpeed = this.canvas.random(-0.02, 0.02);
    }

    // Set the speed multiplier to adjust falling speed
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
        this.speed = this.baseSpeed * this.speedMultiplier;
    }

    // Set temporary size for pulse effect
    setTemporarySize(factor) {
        this.temporarySizeFactor = factor;
        this.size = this.normalSize * factor;
    }
    
    // Reset to normal size
    resetTemporarySize() {
        this.temporarySizeFactor = 1.0;
        this.size = this.normalSize;
    }
    
    // Adjust size based on multiplier
    setSizeMultiplier(multiplier) {
        this.normalSize = this.baseSize * multiplier;
        this.size = this.normalSize * this.temporarySizeFactor;
    }
    
    // Set the wobble intensity multiplier
    setWobbleIntensity(intensity) {
        this.wobbleIntensity = intensity;
        // Make wobble speed more responsive to intensity changes
        // At intensity=0, speed is 30% of base speed
        // At intensity=1, speed is 250% of base speed
        this.wobbleSpeed = this.baseWobbleSpeed * (intensity * 2.2 + 0.3);
    }
    
    // Set wind properties
    setWind(strength, direction) {
        this.windStrength = strength;
        this.windDirection = direction;
    }
    
    // Set the snowflake color
    setColor(r, g, b) {
        this.color = { r, g, b };
    }

    update() {
        // Explosion effect for burst snowflakes
        if (this.explosionVelocityX !== undefined) {
            // Apply explosion velocity
            this.x += this.explosionVelocityX;
            this.y += this.explosionVelocityY;
            
            // Decay explosion effect over time
            this.explosionVelocityX *= this.explosionDecay;
            this.explosionVelocityY *= this.explosionDecay;
            
            // Transition to normal movement when explosion velocity gets small
            if (Math.abs(this.explosionVelocityX) < 0.3 && Math.abs(this.explosionVelocityY) < 0.3) {
                delete this.explosionVelocityX;
                delete this.explosionVelocityY;
            }
        } else {
            // Base vertical movement - falling
            this.y += this.speed;
            
            // Apply wobble effect (side-to-side movement) - enhanced by increasing multiplier
            const wobbleAmount = this.baseWobbleAmount * this.wobbleIntensity * 2.0; // Added *2.0 multiplier
            this.x += this.canvas.sin(this.wobble) * wobbleAmount;
            this.wobble += this.wobbleSpeed;
            
            // Apply wind effect
            if (this.windStrength > 0) {
                // Convert wind direction from degrees to radians
                const windRad = this.canvas.radians(this.windDirection);
                
                // Calculate wind vector components - adjust for size (smaller flakes affected more)
                const inverseSize = this.canvas.map(this.size, 3, 40, 1, 0.3);
                // Increased the wind multiplier from 0.05 to 0.2 for more noticeable effect
                const windForce = this.windStrength * 0.2 * inverseSize;
                
                // Apply wind force in x and y directions
                this.x += Math.cos(windRad) * windForce;
                this.y += Math.sin(windRad) * windForce;
            }
        }
        
        // Rotate the snowflake
        this.rotation += this.rotationSpeed;
        
        // Wrap around edges for x-coordinate
        if (this.x < -50) {
            this.x = this.canvas.width + 50;
        } else if (this.x > this.canvas.width + 50) {
            this.x = -50;
        }
        
        // Reset snowflake when it reaches bottom
        if (this.y > this.canvas.height + this.size) {
            this.resetPosition();
        }
    }

    draw() {
        this.canvas.push();
        this.canvas.noStroke();
        this.canvas.fill(this.color.r, this.color.g, this.color.b, this.opacity);
        this.canvas.translate(this.x, this.y);
        this.canvas.rotate(this.rotation); // Add overall rotation to snowflake

        // Draw a simple snowflake shape
        for (let i = 0; i < 6; i++) {
            this.canvas.push();
            this.canvas.rotate(this.canvas.PI * 2 * i / 6);
            this.canvas.ellipse(0, 0, this.size * 0.2, this.size);
            this.canvas.pop();
        }
        
        // Draw center circle
        this.canvas.ellipse(0, 0, this.size * 0.5);
        
        this.canvas.pop();
    }

    resetPosition() {
        this.x = this.canvas.random(0, this.canvas.width);
        // When resetting, always place snowflakes at various heights above the canvas
        // This ensures a more continuous flow rather than all at the same height
        this.y = this.canvas.random(-150, -10); // Increased range for more variation
    }
}

/**
 * Snowflakes Theme class that extends the base Theme
 */
class SnowflakesTheme extends Theme {
    constructor() {
        super();
        this.snowflakes = [];
        this.numSnowflakes = 200; // Default number of snowflakes
        this.sizeMultiplier = 1; // Default size multiplier
        this.speedMultiplier = 1; // Default speed multiplier
        this.wobbleIntensity = 0.5; // Default wobble intensity
        this.windStrength = 0; // Default wind strength
        this.windDirection = 0; // Default wind direction (degrees)
        
        // Default colors
        this.snowflakeColor = { r: 255, g: 255, b: 255 }; // White
        this.backgroundColor = { r: 0, g: 10, b: 40 }; // Dark blue
        
        // For burst flash effect
        this.backgroundFlash = 0;
        this.flashDecay = 0.1; // How quickly the flash fades
        
        // Audio reactive properties
        this.mic = null;
        this.fft = null;
        this.audioEnabled = false;
        this.audioSensitivity = 5;
        
        // Audio effect toggles
        this.audioAffectsWind = true;
        this.audioAffectsColor = true;
        this.audioAffectsBursts = true;
        this.audioAffectsSize = true;
        
        // Audio analysis values
        this.amplitude = 0;
        this.bass = 0;
        this.mid = 0;
        this.high = 0;
        
        // Burst effect settings
        this.burstThreshold = 0.7; // Default threshold (0.0-1.0)
        this.burstSensitivity = 5; // Default sensitivity (1-10)
        this.lastBurstTime = 0;
        this.burstCooldown = 500; // milliseconds
        
        // For color shift effect
        this.originalSnowflakeColor = { r: 255, g: 255, b: 255 };
        this.originalBackgroundColor = { r: 0, g: 10, b: 40 };
    }

    // Setter methods for controller values
    setNumberOfSnowflakes(num) {
        const previouslyRunning = this.isRunning;
        
        // Stop animation temporarily if running
        if (previouslyRunning) {
            this.isRunning = false;
        }
        
        this.numSnowflakes = num;
        this.updateSnowflakes();
        
        // Resume animation if it was running before
        if (previouslyRunning) {
            this.isRunning = true;
        }
    }

    setSizeMultiplier(multiplier) {
        this.sizeMultiplier = multiplier;
        // Update existing snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.setSizeMultiplier(this.sizeMultiplier);
        }
    }

    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
        // Update existing snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.setSpeedMultiplier(this.speedMultiplier);
        }
    }
    
    // Set wobble intensity
    setWobbleIntensity(intensity) {
        this.wobbleIntensity = intensity;
        // Update existing snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.setWobbleIntensity(intensity);
        }
    }
    
    // Set wind properties
    setWind(strength, direction) {
        this.windStrength = strength;
        this.windDirection = direction;
        // Update existing snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.setWind(strength, direction);
        }
    }
    
    // Set snowflake color
    setSnowflakeColor(hexColor) {
        // Convert hex color to RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        this.snowflakeColor = { r, g, b };
        
        // Update existing snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.setColor(r, g, b);
        }
    }
    
    // Set background color
    setBackgroundColor(hexColor) {
        // Convert hex color to RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        this.backgroundColor = { r, g, b };
    }

    // Audio methods
    setupAudio() {
        if (!this.mic) {
            // Create microphone input
            this.mic = new p5.AudioIn();
            
            // Create FFT for frequency analysis
            this.fft = new p5.FFT();
            this.fft.setInput(this.mic);
        }
    }
    
    startAudio() {
        this.setupAudio();
        this.mic.start();
        this.audioEnabled = true;
        
        // Store original colors for reference
        this.originalSnowflakeColor = { ...this.snowflakeColor };
        this.originalBackgroundColor = { ...this.backgroundColor };
    }
    
    stopAudio() {
        if (this.mic) {
            this.mic.stop();
        }
        this.audioEnabled = false;
        
        // Reset any audio-affected properties
        this.resetAudioEffects();
    }
    
    resetAudioEffects() {
        // Reset any properties that might have been changed by audio
        // This ensures a smooth transition when audio is disabled
        if (this.audioAffectsWind) {
            // Only reset audio-controlled wind, don't override manual settings
            if (this.windStrength > 0 && this.wasAudioControllingWind) {
                this.windStrength = 0;
                this.setWind(0, this.windDirection);
            }
            this.wasAudioControllingWind = false;
        }
        
        if (this.audioAffectsColor) {
            // Reset colors to original values before audio was enabled
            this.snowflakeColor = { ...this.originalSnowflakeColor };
            this.backgroundColor = { ...this.originalBackgroundColor };
            this.updateSnowflakeColors();
        }
        
        if (this.audioAffectsSize) {
            // Reset size if it was being pulsed by audio
            this.setSizeMultiplier(this.sizeMultiplier);
        }
    }
    
    setAudioSensitivity(value) {
        this.audioSensitivity = value;
    }
    
    setAudioEffectToggles(wind, color, burst, size) {
        this.audioAffectsWind = wind;
        this.audioAffectsColor = color;
        this.audioAffectsBursts = burst;
        this.audioAffectsSize = size;
    }
    
    setBurstSensitivity(value) {
        // Convert 1-10 scale to a threshold between 0.9 (less sensitive) and 0.3 (more sensitive)
        // Higher sensitivity value = Lower threshold required to trigger
        this.burstSensitivity = value;
        this.burstThreshold = 0.9 - ((value - 1) / 9) * 0.6;
    }
    
    updateAudioAnalysis() {
        if (!this.audioEnabled || !this.mic) return;
        
        // Get volume level (0.0 to 1.0)
        const rawVolume = this.mic.getLevel();
        
        // Apply sensitivity adjustment (higher sensitivity = more responsive)
        // Scale from 1-10 to a multiplier from 1.0 to 3.0
        const sensitivityMultiplier = 1 + ((this.audioSensitivity - 1) / 9) * 2;
        this.amplitude = Math.min(rawVolume * sensitivityMultiplier, 1.0);
        
        // Update FFT analysis
        this.fft.analyze();
        
        // Get energy in different frequency ranges (0-255)
        const bassEnergy = this.fft.getEnergy("bass");
        const midEnergy = this.fft.getEnergy("mid");
        const highEnergy = this.fft.getEnergy("treble");
        
        // Normalize to 0.0-1.0 range
        this.bass = bassEnergy / 255;
        this.mid = midEnergy / 255;
        this.high = highEnergy / 255;
        
        // Apply audio effects
        this.applyAudioEffects();
    }
    
    applyAudioEffects() {
        // Wind strength controlled by amplitude
        if (this.audioAffectsWind) {
            const audioWindStrength = Math.floor(this.amplitude * 10);
            if (audioWindStrength > 0) {
                this.wasAudioControllingWind = true;
                // Only update wind if audio level is significant enough
                if (audioWindStrength >= 1) {
                    // Use bass and mid frequencies to determine wind direction
                    // This creates a natural flow where bass frequencies push in one direction,
                    // and higher frequencies push in another
                    const bassDirection = Math.floor(this.bass * 180); // 0-180 degrees
                    const midDirection = Math.floor(this.mid * 180) + 180; // 180-360 degrees
                    
                    // Blend the directions based on which frequency is more dominant
                    const blendFactor = this.mid / (this.bass + this.mid || 1);
                    let audioWindDirection = Math.floor(bassDirection * (1 - blendFactor) + midDirection * blendFactor);
                    
                    // Ensure direction is within 0-360 range
                    audioWindDirection = audioWindDirection % 360;
                    
                    // Update wind
                    this.setWind(audioWindStrength, audioWindDirection);
                }
            } else if (this.wasAudioControllingWind) {
                // Reset wind when sound stops
                this.setWind(0, this.windDirection);
            }
        }
        
        // Color shifting based on frequencies
        if (this.audioAffectsColor && this.amplitude > 0.05) {
            // Shift snowflake color based on high frequencies
            if (this.high > 0.1) {
                // Create a blue-purple glow for high frequencies
                const r = this.originalSnowflakeColor.r;
                const g = Math.max(0, Math.floor(this.originalSnowflakeColor.g - (this.high * 50)));
                const b = Math.min(255, Math.floor(this.originalSnowflakeColor.b + (this.high * 50)));
                
                this.snowflakeColor = { r, g, b };
                this.updateSnowflakeColors();
            }
            
            // Shift background color based on bass frequencies
            if (this.bass > 0.2) {
                // Create a subtle warm glow for bass
                const r = Math.min(40, Math.floor(this.originalBackgroundColor.r + (this.bass * 40)));
                const g = Math.min(20, Math.floor(this.originalBackgroundColor.g + (this.bass * 10)));
                const b = this.originalBackgroundColor.b;
                
                this.backgroundColor = { r, g, b };
            } else {
                // Reset to original color when bass is low
                this.backgroundColor = { ...this.originalBackgroundColor };
            }
        }
        
        // Burst of snowflakes on loud sounds
        if (this.audioAffectsBursts) {
            // Calculate a dynamic threshold based on sensitivity setting
            const effectiveThreshold = this.burstThreshold;
            
            if (this.amplitude > effectiveThreshold) {
                const currentTime = Date.now();
                // Only trigger a burst if enough time has passed since the last one
                if (currentTime - this.lastBurstTime > this.burstCooldown) {
                    this.createSnowflakeBurst();
                    this.lastBurstTime = currentTime;
                }
            }
        }
        
        // Size pulsing based on mid-range frequencies
        if (this.audioAffectsSize && this.mid > 0.15) {
            const pulseFactor = 1 + (this.mid * 0.5); // 1.0 to 1.5x size
            
            // Temporarily adjust size of all snowflakes
            for (let snowflake of this.snowflakes) {
                snowflake.setTemporarySize(pulseFactor);
            }
        } else if (this.audioAffectsSize) {
            // Reset to normal size
            for (let snowflake of this.snowflakes) {
                snowflake.resetTemporarySize();
            }
        }
    }
    
    createSnowflakeBurst() {
        // Create a MUCH larger burst of snowflakes for dramatic effect
        const sensitivityFactor = this.burstSensitivity / 5; // 0.2 to 2.0 multiplier
        const burstStrength = Math.floor(this.amplitude * 60 * sensitivityFactor) + 20; // Increased from 20 to 60 base multiplier, and min from 5 to 20
        const burstCount = Math.min(burstStrength, 100); // Cap at 100 snowflakes per burst (increased from 40)
        
        // Create temporary snowflakes that will fade away
        for (let i = 0; i < burstCount; i++) {
            const snowflake = new Snowflake(this.canvas, false, this.sizeMultiplier * 1.5); // Make burst snowflakes 50% larger
            
            // Set higher speed for more dramatic movement
            snowflake.setSpeedMultiplier(this.speedMultiplier * (1.2 + this.canvas.random(0, 1.0)));
            
            // Make burst snowflakes slightly different color for visual distinction
            // Add a subtle blue tint to make them stand out
            const burstColorR = Math.max(200, this.snowflakeColor.r - 20);
            const burstColorG = Math.max(200, this.snowflakeColor.g - 20);
            const burstColorB = Math.min(255, this.snowflakeColor.b + 30); // Add blue tint
            
            snowflake.setColor(burstColorR, burstColorG, burstColorB);
            
            // More intense wobble for burst snowflakes
            snowflake.setWobbleIntensity(this.wobbleIntensity * 2.0);
            snowflake.setWind(this.windStrength, this.windDirection);
            
            // Mark as temporary and set longer lifespan
            snowflake.temporary = true;
            snowflake.lifespan = 150; // Increased from 100 for longer visibility
            
            // Make these snowflakes explode outward from center
            // Calculate random angle and distance from burst center
            const angle = this.canvas.random(0, this.canvas.TWO_PI);
            const distance = this.canvas.random(5, 30);
            
            // Position around center of screen or random burst point
            const centerX = this.canvas.width / 2 + this.canvas.random(-100, 100);
            const centerY = this.canvas.height / 3 + this.canvas.random(-50, 50);
            
            // Set position based on angle and distance
            snowflake.x = centerX + Math.cos(angle) * distance;
            snowflake.y = centerY + Math.sin(angle) * distance;
            
            // Add explosion velocity
            snowflake.explosionVelocityX = Math.cos(angle) * this.canvas.random(2, 8);
            snowflake.explosionVelocityY = Math.sin(angle) * this.canvas.random(2, 8);
            snowflake.explosionDecay = 0.95; // Decay factor for explosion velocity
            
            this.snowflakes.push(snowflake);
        }
        
        // Flash effect - temporarily brighten background
        this.backgroundFlash = 1.0; // Full flash
    }
    
    updateSnowflakeColors() {
        for (let snowflake of this.snowflakes) {
            snowflake.setColor(
                this.snowflakeColor.r, 
                this.snowflakeColor.g, 
                this.snowflakeColor.b
            );
        }
    }

    updateSnowflakes() {
        // Adjust number of snowflakes
        if (this.snowflakes.length < this.numSnowflakes) {
            // Add more snowflakes
            const numToAdd = this.numSnowflakes - this.snowflakes.length;
            for (let i = 0; i < numToAdd; i++) {
                const snowflake = new Snowflake(this.canvas, true, this.sizeMultiplier);
                snowflake.setSpeedMultiplier(this.speedMultiplier);
                snowflake.setColor(this.snowflakeColor.r, this.snowflakeColor.g, this.snowflakeColor.b);
                snowflake.setWobbleIntensity(this.wobbleIntensity);
                snowflake.setWind(this.windStrength, this.windDirection);
                this.snowflakes.push(snowflake);
            }
        } else if (this.snowflakes.length > this.numSnowflakes) {
            // Remove excess snowflakes
            this.snowflakes = this.snowflakes.slice(0, this.numSnowflakes);
        }
        
        // Clean up temporary snowflakes that have faded away
        this.snowflakes = this.snowflakes.filter(snowflake => {
            return !snowflake.temporary || snowflake.lifespan > 0;
        });
    }

    setup() {
        // Create snowflakes with initial distribution throughout canvas
        this.snowflakes = [];
        for (let i = 0; i < this.numSnowflakes; i++) {
            const snowflake = new Snowflake(this.canvas, true, this.sizeMultiplier);
            snowflake.setSpeedMultiplier(this.speedMultiplier);
            snowflake.setColor(this.snowflakeColor.r, this.snowflakeColor.g, this.snowflakeColor.b);
            snowflake.setWobbleIntensity(this.wobbleIntensity);
            snowflake.setWind(this.windStrength, this.windDirection);
            this.snowflakes.push(snowflake);
        }
    }

    update() {
        if (!this.isRunning) return;
        
        // Update audio analysis if enabled
        if (this.audioEnabled) {
            this.updateAudioAnalysis();
        }
        
        // Update all snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.update();
            
            // Update lifespan of temporary snowflakes
            if (snowflake.temporary && snowflake.lifespan > 0) {
                snowflake.lifespan--;
                // Fade out opacity as lifespan decreases
                snowflake.opacity = Math.floor((snowflake.lifespan / 100) * 255);
            }
        }
        
        // Update background flash effect
        if (this.backgroundFlash > 0) {
            this.backgroundFlash -= this.flashDecay;
            if (this.backgroundFlash < 0) this.backgroundFlash = 0;
        }
    }

    draw() {
        if (!this.isRunning) return;

        // Clear background with custom color, apply flash effect if active
        if (this.backgroundFlash > 0) {
            // Calculate flash brightness - brightens the background
            const flashR = Math.min(255, this.backgroundColor.r + (255 - this.backgroundColor.r) * this.backgroundFlash);
            const flashG = Math.min(255, this.backgroundColor.g + (255 - this.backgroundColor.g) * this.backgroundFlash);
            const flashB = Math.min(255, this.backgroundColor.b + (255 - this.backgroundColor.b) * this.backgroundFlash);
            
            this.canvas.background(flashR, flashG, flashB);
        } else {
            this.canvas.background(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b);
        }
        
        // Draw all snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.draw();
        }
    }

    cleanup() {
        // Nothing specific to clean up
        this.snowflakes = [];
    }
}