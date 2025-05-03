/**
 * Snowflakes Theme Implementation
 */
import { Theme } from '../theme.js';
import { settingsManager } from '../../core/app-config.js';
import { eventBus } from '../../core/event-bus.js';

/**
 * Class representing an individual snowflake
 */
class Snowflake {
  constructor(p5, size, color, x, y, speedMultiplier = 1, wobbleIntensity = 0.5) {
    this.p5 = p5;
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
    this.angle = p5.random(0, 360);
    this.spinDirection = p5.random([-1, 1]);
    this.spinSpeed = p5.random(0.3, 1);
    this.fallSpeed = p5.random(0.5, 1.5) * speedMultiplier;
    this.wobbleSize = p5.random(0.1, 2) * wobbleIntensity;
    this.offsetX = 0;
    this.alpha = 255;
    this.branches = p5.round(p5.random(4, 8)); // Between 4 and 8 branches
  }
  
  /**
   * Update the snowflake position and state
   * @param {number} windForce - Current wind force
   * @param {number} windAngle - Current wind angle in degrees
   * @param {number} wobbleIntensity - Intensity of wobble effect
   */
  update(windForce, windAngle, wobbleIntensity) {
    // Calculate wind effect
    const windRad = this.p5.radians(windAngle);
    const windX = Math.cos(windRad) * windForce * 0.05;
    const time = this.p5.millis() * 0.001; // Time in seconds
    
    // Update position with wobble and wind
    this.offsetX = Math.sin(time + this.x * 0.01) * this.wobbleSize * wobbleIntensity;
    this.x += windX + this.offsetX * 0.1;
    this.y += this.fallSpeed;
    
    // Rotate the snowflake
    this.angle += this.spinSpeed * this.spinDirection;
    
    // Wrap around the screen
    if (this.y > this.p5.height + this.size) {
      this.y = -this.size;
      this.x = this.p5.random(0, this.p5.width);
    }
    
    // Wrap around horizontally too
    if (this.x > this.p5.width + this.size) {
      this.x = -this.size;
    } else if (this.x < -this.size) {
      this.x = this.p5.width + this.size;
    }
  }
  
  /**
   * Draw the snowflake
   */
  draw() {
    this.p5.push();
    this.p5.translate(this.x, this.y);
    this.p5.rotate(this.p5.radians(this.angle));
    this.p5.noStroke();
    this.p5.fill(this.color[0], this.color[1], this.color[2], this.alpha);
    
    // Draw snowflake branches
    for (let i = 0; i < this.branches; i++) {
      const angle = (360 / this.branches) * i;
      this.p5.push();
      this.p5.rotate(this.p5.radians(angle));
      this.p5.rect(0, 0, this.size * 0.1, this.size);
      this.p5.pop();
    }
    
    // Draw center circle
    this.p5.ellipse(0, 0, this.size * 0.25, this.size * 0.25);
    this.p5.pop();
  }
  
  /**
   * Set the fall speed multiplier
   * @param {number} multiplier - Speed multiplier
   */
  setSpeedMultiplier(multiplier) {
    this.fallSpeed = this.p5.random(0.5, 1.5) * multiplier;
  }
}

/**
 * SnowflakesTheme class - Implements a winter theme with falling snowflakes
 */
export default class SnowflakesTheme extends Theme {
  constructor() {
    super();
    
    // Theme settings (load from settings manager or use defaults)
    this.numSnowflakes = settingsManager.get('themes.snowflakes.count', 200);
    this.sizeMultiplier = settingsManager.get('themes.snowflakes.size', 10) / 10;
    this.speedMultiplier = settingsManager.get('themes.snowflakes.speed', 1);
    this.wobbleIntensity = settingsManager.get('themes.snowflakes.wobbleIntensity', 0.5);
    this.backgroundColor = settingsManager.get('themes.snowflakes.backgroundColor', '#000A28');
    this.snowflakeColor = settingsManager.get('themes.snowflakes.snowflakeColor', '#FFFFFF');
    
    // Wind settings
    this.windStrength = settingsManager.get('themes.snowflakes.windStrength', 0);
    this.windDirection = settingsManager.get('themes.snowflakes.windDirection', 0);
    
    // Burst settings
    this.burstIntensity = settingsManager.get('themes.snowflakes.burstIntensity', 20);
    this.burstSizeMultiplier = settingsManager.get('themes.snowflakes.burstSizeMultiplier', 1.5);
    this.colorVariation = settingsManager.get('themes.snowflakes.colorVariation', 30);
    
    // Internal variables
    this.snowflakes = [];
    this.parsedColor = [255, 255, 255]; // Default white
  }
  
  /**
   * Initialize the theme
   * @param {p5} p5Instance - The p5.js instance
   */
  init(p5Instance) {
    super.init(p5Instance);
    
    // Parse default colors
    this.parsedBackgroundColor = this.parseColor(this.backgroundColor);
    this.parsedColor = this.parseColor(this.snowflakeColor);
    
    // Create initial snowflakes
    this.createSnowflakes();
    
    // Set up event listeners
    eventBus.on('resize', () => this.handleResize());
  }
  
  /**
   * Start the theme animation
   */
  start() {
    if (!super.start()) return false;
    
    // Send state to settings
    settingsManager.set('themes.snowflakes.active', true);
    
    return true;
  }
  
  /**
   * Stop the theme animation
   */
  stop() {
    if (!super.stop()) return false;
    
    // Send state to settings
    settingsManager.set('themes.snowflakes.active', false);
    
    return true;
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.snowflakes = [];
    super.cleanup();
  }
  
  /**
   * Create all snowflakes
   */
  createSnowflakes() {
    this.snowflakes = [];
    
    for (let i = 0; i < this.numSnowflakes; i++) {
      this.addSnowflake();
    }
  }
  
  /**
   * Add a single snowflake to the scene
   */
  addSnowflake() {
    const { p5 } = this;
    
    // Random starting position
    const x = p5.random(0, p5.width);
    const y = p5.random(0, p5.height);
    
    // Random size around base size
    const size = p5.random(5, 15) * this.sizeMultiplier;
    
    // Create snowflake with theme settings
    const snowflake = new Snowflake(
      p5, 
      size, 
      this.parsedColor, 
      x, 
      y, 
      this.speedMultiplier,
      this.wobbleIntensity
    );
    
    this.snowflakes.push(snowflake);
  }
  
  /**
   * Create a burst of snowflakes at a specific position (for audio reaction)
   * @param {number} x - X coordinate of burst center
   * @param {number} y - Y coordinate of burst center
   * @param {number} intensity - Intensity of the burst (0-1)
   */
  createSnowflakeBurst(x, y, intensity = 1) {
    if (!this.isRunning) return;
    
    const { p5 } = this;
    
    // Scale number of snowflakes based on intensity and burst intensity setting
    const count = Math.ceil(this.burstIntensity * intensity);
    const burstSize = this.burstSizeMultiplier * 50; // Base radius of the burst
    
    // Create the burst
    for (let i = 0; i < count; i++) {
      // Random position within burst radius
      const angle = p5.random(0, p5.TWO_PI);
      const distance = p5.random(0, burstSize * intensity);
      const burstX = x + Math.cos(angle) * distance;
      const burstY = y + Math.sin(angle) * distance;
      
      // Random size based on theme settings
      const size = p5.random(5, 15) * this.sizeMultiplier;
      
      // Calculate color variation for this snowflake
      let colorVar = this.parsedColor.slice(); // Clone array
      
      if (this.colorVariation > 0) {
        // Apply random variation to each color channel
        colorVar = colorVar.map(channel => {
          const variation = p5.random(-this.colorVariation, this.colorVariation);
          return p5.constrain(channel + variation, 0, 255);
        });
      }
      
      // Create snowflake
      const snowflake = new Snowflake(
        p5, 
        size, 
        colorVar, 
        burstX, 
        burstY, 
        this.speedMultiplier,
        this.wobbleIntensity
      );
      
      this.snowflakes.push(snowflake);
      
      // Emit event for audio-visual feedback
      eventBus.emit('snowflake-burst-created', { x, y, count, intensity });
    }
    
    // Trim excess snowflakes if we've created too many
    const maxSnowflakes = Math.max(this.numSnowflakes * 3, 1000);
    if (this.snowflakes.length > maxSnowflakes) {
      this.snowflakes.splice(0, this.snowflakes.length - maxSnowflakes);
    }
  }
  
  /**
   * Update the theme state (called each frame)
   */
  update() {
    if (!this.isRunning) return;
    
    // Update each snowflake
    this.snowflakes.forEach(snowflake => {
      snowflake.update(this.windStrength, this.windDirection, this.wobbleIntensity);
    });
  }
  
  /**
   * Draw the theme (called each frame)
   */
  draw() {
    if (!this.isRunning) return;
    
    const { p5 } = this;
    
    // Draw background
    p5.background(
      this.parsedBackgroundColor[0], 
      this.parsedBackgroundColor[1], 
      this.parsedBackgroundColor[2]
    );
    
    // Draw each snowflake
    this.snowflakes.forEach(snowflake => {
      snowflake.draw();
    });
  }
  
  /**
   * Handle window resize
   */
  handleResize() {
    // Update snowflake positions if needed for new dimensions
  }
  
  /**
   * Set the number of snowflakes
   * @param {number} count - New snowflake count
   */
  setNumberOfSnowflakes(count) {
    this.numSnowflakes = count;
    
    // Adjust the number of snowflakes
    if (this.snowflakes.length > count) {
      // Remove excess snowflakes
      this.snowflakes.splice(count);
    } else if (this.snowflakes.length < count) {
      // Add more snowflakes
      const toAdd = count - this.snowflakes.length;
      for (let i = 0; i < toAdd; i++) {
        this.addSnowflake();
      }
    }
  }
  
  /**
   * Set the size multiplier for snowflakes
   * @param {number} multiplier - Size multiplier
   */
  setSizeMultiplier(multiplier) {
    this.sizeMultiplier = multiplier;
    
    // Update existing snowflakes
    // This doesn't immediately resize them, but new ones will use the new size
  }
  
  /**
   * Set the speed multiplier for snowflakes
   * @param {number} multiplier - Speed multiplier
   */
  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
    
    // Update existing snowflakes
    this.snowflakes.forEach(snowflake => {
      snowflake.setSpeedMultiplier(multiplier);
    });
  }
  
  /**
   * Set the wobble intensity
   * @param {number} intensity - Wobble intensity (0-1)
   */
  setWobbleIntensity(intensity) {
    this.wobbleIntensity = intensity;
    // Wobble intensity is applied in the update method
  }
  
  /**
   * Set wind parameters
   * @param {number} strength - Wind strength
   * @param {number} direction - Wind direction in degrees
   */
  setWind(strength, direction) {
    this.windStrength = strength;
    this.windDirection = direction;
    // Wind is applied in the update method
  }
  
  /**
   * Set the background color
   * @param {string} hexColor - Hex color string
   */
  setBackgroundColor(hexColor) {
    this.backgroundColor = hexColor;
    this.parsedBackgroundColor = this.parseColor(hexColor);
  }
  
  /**
   * Set the snowflake color
   * @param {string} hexColor - Hex color string
   */
  setSnowflakeColor(hexColor) {
    this.snowflakeColor = hexColor;
    this.parsedColor = this.parseColor(hexColor);
  }
  
  /**
   * Set the burst intensity
   * @param {number} intensity - Burst intensity value
   */
  setBurstIntensity(intensity) {
    this.burstIntensity = intensity;
  }
  
  /**
   * Set the burst size multiplier
   * @param {number} multiplier - Burst size multiplier
   */
  setBurstSizeMultiplier(multiplier) {
    this.burstSizeMultiplier = multiplier;
  }
  
  /**
   * Set the color variation for burst snowflakes
   * @param {number} variation - Color variation amount (0-255)
   */
  setBurstColorVariation(variation) {
    this.colorVariation = variation;
  }
  
  /**
   * Convert hex color to RGB array
   * @param {string} hexColor - Hex color string
   * @returns {Array} RGB array [r, g, b]
   */
  parseColor(hexColor) {
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Parse the color
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    return [r, g, b];
  }
}