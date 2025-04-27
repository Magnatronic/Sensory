/**
 * Base Theme class that all themes should extend
 */
class Theme {
    constructor() {
        this.isRunning = false;
        this.canvas = null;
    }

    /**
     * Initialize the theme with a p5.js canvas
     * @param {p5} canvas - The p5.js instance 
     */
    init(canvas) {
        this.canvas = canvas;
        this.setup();
    }

    /**
     * Setup method to be implemented by child classes
     */
    setup() {
        // To be implemented by child classes
    }

    /**
     * Start the theme animation
     */
    start() {
        this.isRunning = true;
    }

    /**
     * Stop the theme animation
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Update method to be called on each frame
     * Should be implemented by child classes
     */
    update() {
        // To be implemented by child classes
    }

    /**
     * Draw method to be called on each frame
     * Should be implemented by child classes
     */
    draw() {
        // To be implemented by child classes
    }

    /**
     * Clean up resources when theme is changed or stopped
     */
    cleanup() {
        // To be implemented by child classes if needed
    }
}