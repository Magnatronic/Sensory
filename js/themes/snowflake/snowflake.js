/**
 * A single Snowflake object
 */
class Snowflake {
    constructor(canvas, initialDistribution = false, sizeMultiplier = 1, isBurst = false) {
        this.canvas = canvas;
        this.x = this.canvas.random(0, this.canvas.width);
        // For initial setup, distribute snowflakes throughout the entire canvas height
        // This prevents the wave effect by having snowflakes at various heights
        if (initialDistribution) {
            this.y = this.canvas.random(-100, this.canvas.height);
        } else {
            this.y = this.canvas.random(-100, -10);
        }
        
        // Base size affected by the size multiplier parameter
        this.baseSize = this.canvas.random(3, 10);
        this.size = this.baseSize * sizeMultiplier;
        
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
        
        // Burst animation properties
        this.isBurst = isBurst;
        if (isBurst) {
            // Burst snowflakes have velocity in x direction too
            this.xVelocity = this.canvas.random(-3, 3);
            this.yVelocity = this.canvas.random(-5, -1); // Initial upward movement
            this.gravity = 0.1;
            this.lifespan = 255; // For fade out effect
            this.lifespanReduction = this.canvas.random(2, 5); // How quickly it fades
            // Make burst snowflakes a bit larger and faster
            this.size *= this.canvas.random(1.0, 1.5);
        }
    }

    // Set the speed multiplier to adjust falling speed
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
        this.speed = this.baseSpeed * this.speedMultiplier;
    }

    // Set the size multiplier to adjust snowflake size
    setSizeMultiplier(multiplier) {
        this.size = this.baseSize * multiplier;
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

    // For burst snowflakes, set a specific position
    setBurstPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    // For burst snowflakes, set a specific velocity
    setBurstVelocity(angle, speed) {
        this.xVelocity = Math.cos(angle) * speed;
        this.yVelocity = Math.sin(angle) * speed;
    }

    update() {
        if (this.isBurst) {
            // Burst snowflake physics
            this.x += this.xVelocity;
            this.y += this.yVelocity;
            this.yVelocity += this.gravity; // Apply gravity
            this.lifespan -= this.lifespanReduction;
            this.opacity = this.lifespan; // Fade out based on lifespan
            
            // Apply rotation
            this.rotation += this.rotationSpeed * 1.5; // Faster rotation for burst
        } else {
            // Regular snowflake physics
            // Base vertical movement - falling
            this.y += this.speed;
            
            // Apply wobble effect (side-to-side movement) - enhanced by increasing multiplier
            const wobbleAmount = this.baseWobbleAmount * this.wobbleIntensity * 2.0;
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
    }

    draw() {
        if (this.opacity <= 0) return; // Don't draw completely transparent flakes
        
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

    // Check if burst snowflake should be removed
    isDead() {
        return this.isBurst && this.lifespan <= 0;
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
        this.burstSnowflakes = []; // Separate array for burst effects
        this.numSnowflakes = 200; // Default number of snowflakes
        this.sizeMultiplier = 1; // Default size multiplier
        this.speedMultiplier = 1; // Default speed multiplier
        this.wobbleIntensity = 0.5; // Default wobble intensity
        this.windStrength = 0; // Default wind strength
        this.windDirection = 0; // Default wind direction (degrees)
        
        // Default colors
        this.snowflakeColor = { r: 255, g: 255, b: 255 }; // White
        this.backgroundColor = { r: 0, g: 10, b: 40 }; // Dark blue
        
        // Burst effect settings
        this.burstIntensity = 20; // Number of snowflakes per burst
        this.burstSizeMultiplier = 1.5; // Size multiplier for burst snowflakes
        this.burstColorVariation = 30; // Random color variation for bursts
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

    // Create a burst of snowflakes at a specified position
    createSnowflakeBurst(x, y) {
        // Use random position if not specified
        x = x !== undefined ? x : this.canvas.random(this.canvas.width * 0.2, this.canvas.width * 0.8);
        y = y !== undefined ? y : this.canvas.random(this.canvas.height * 0.2, this.canvas.height * 0.8);
        
        // Create the burst snowflakes
        for (let i = 0; i < this.burstIntensity; i++) {
            const burstFlake = new Snowflake(this.canvas, false, this.sizeMultiplier * this.burstSizeMultiplier, true);
            burstFlake.setBurstPosition(x, y);
            
            // Set random velocities in all directions
            const angle = this.canvas.random(0, this.canvas.TWO_PI);
            const speed = this.canvas.random(2, 8) * this.speedMultiplier;
            burstFlake.setBurstVelocity(angle, speed);
            
            // Add subtle color variation to burst snowflakes
            const variation = this.burstColorVariation;
            const r = this.snowflakeColor.r + this.canvas.random(-variation, variation);
            const g = this.snowflakeColor.g + this.canvas.random(-variation, variation);
            const b = this.snowflakeColor.b + this.canvas.random(-variation, variation);
            burstFlake.setColor(
                this.canvas.constrain(r, 0, 255),
                this.canvas.constrain(g, 0, 255),
                this.canvas.constrain(b, 0, 255)
            );
            
            this.burstSnowflakes.push(burstFlake);
        }
    }
    
    // Set burst intensity (number of snowflakes per burst)
    setBurstIntensity(intensity) {
        this.burstIntensity = intensity;
    }
    
    // Set size multiplier specifically for burst snowflakes
    setBurstSizeMultiplier(multiplier) {
        this.burstSizeMultiplier = multiplier;
    }
    
    // Set color variation for burst snowflakes
    setBurstColorVariation(variation) {
        this.burstColorVariation = variation;
    }
    
    /**
     * Handles sound detection to create snowflake bursts
     * Called by ThemeManager when a sound is detected
     * @param {number} intensity - Sound intensity from 0-1
     */
    onSoundDetected(intensity) {
        console.log(`SnowflakesTheme: Creating snowflake burst with intensity ${intensity}`);
        
        if (!this.isRunning || !this.canvas) {
            console.warn("SnowflakesTheme: Theme not running, cannot create burst");
            return;
        }
        
        // Scale burst intensity based on sound intensity
        const scaledBurstIntensity = Math.floor(this.burstIntensity * intensity);
        
        // Store current burst intensity
        const originalBurstIntensity = this.burstIntensity;
        
        // Temporarily set the burst intensity based on sound
        this.burstIntensity = Math.max(5, scaledBurstIntensity);
        
        // Create a burst at a random position
        const x = this.canvas.random(this.canvas.width * 0.2, this.canvas.width * 0.8);
        const y = this.canvas.random(this.canvas.height * 0.3, this.canvas.height * 0.7);
        this.createSnowflakeBurst(x, y);
        
        // Restore original burst intensity
        this.burstIntensity = originalBurstIntensity;
    }

    update() {
        if (!this.isRunning) return;
        
        // Update all snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.update();
        }
        
        // Update burst snowflakes
        for (let i = this.burstSnowflakes.length - 1; i >= 0; i--) {
            this.burstSnowflakes[i].update();
            
            // Remove dead burst snowflakes
            if (this.burstSnowflakes[i].isDead()) {
                this.burstSnowflakes.splice(i, 1);
            }
        }
    }

    draw() {
        if (!this.isRunning) return;

        // Clear background with custom color
        this.canvas.background(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b);
        
        // Draw all snowflakes
        for (let snowflake of this.snowflakes) {
            snowflake.draw();
        }
        
        // Draw all burst snowflakes
        for (let snowflake of this.burstSnowflakes) {
            snowflake.draw();
        }
    }

    cleanup() {
        // Clear both regular and burst snowflakes
        this.snowflakes = [];
        this.burstSnowflakes = [];
    }
}