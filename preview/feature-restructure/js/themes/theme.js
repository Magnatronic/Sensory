/**
 * Base Theme class
 * Defines the interface for all themes
 */
export class Theme {
  constructor() {
    this.p5 = null;
    this.isRunning = false;
    this.isInitialized = false;
  }

  /**
   * Initialize the theme
   * @param {p5} p5Instance - The p5.js instance
   */
  init(p5Instance) {
    this.p5 = p5Instance;
    this.isInitialized = true;
  }

  /**
   * Start the theme animation
   */
  start() {
    if (!this.isInitialized) {
      console.error('Theme not initialized');
      return false;
    }
    this.isRunning = true;
    return true;
  }

  /**
   * Stop the theme animation
   */
  stop() {
    this.isRunning = false;
    return true;
  }

  /**
   * Update the theme state (called each frame)
   */
  update() {
    // To be implemented by child classes
  }

  /**
   * Draw the theme (called each frame)
   */
  draw() {
    // To be implemented by child classes
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // To be implemented by child classes
    this.isInitialized = false;
  }

  /**
   * Handle window resize events
   */
  resize(width, height) {
    // To be implemented by child classes
  }
}