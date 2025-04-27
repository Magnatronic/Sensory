/**
 * ThemeManager class to handle theme selection and switching
 */
class ThemeManager {
    constructor() {
        this.themes = {};
        this.currentTheme = null;
        this.activeThemeId = null;
    }

    /**
     * Register a theme with the theme manager
     * @param {string} id - Unique identifier for the theme
     * @param {Theme} theme - An instance of a Theme-derived class
     */
    registerTheme(id, theme) {
        this.themes[id] = theme;
    }

    /**
     * Get a theme by its ID
     * @param {string} id - Theme identifier
     * @returns {Theme} The requested theme or null
     */
    getTheme(id) {
        return this.themes[id] || null;
    }

    /**
     * Get all registered themes
     * @returns {Object} Object with all themes
     */
    getAllThemes() {
        return this.themes;
    }

    /**
     * Initialize all themes with a p5.js canvas
     * @param {p5} canvas - The p5.js instance
     */
    initThemes(canvas) {
        for (const id in this.themes) {
            this.themes[id].init(canvas);
        }
    }

    /**
     * Switch to a different theme
     * @param {string} id - The ID of the theme to switch to
     * @returns {boolean} True if switch was successful
     */
    switchTheme(id) {
        // Check if theme exists
        const newTheme = this.getTheme(id);
        if (!newTheme) {
            console.error(`Theme with id "${id}" does not exist.`);
            return false;
        }

        // Stop and cleanup current theme if there is one
        if (this.currentTheme) {
            this.currentTheme.stop();
            this.currentTheme.cleanup();
        }

        // Set new theme as current
        this.currentTheme = newTheme;
        this.activeThemeId = id;
        
        // Return true to indicate successful switch
        return true;
    }

    /**
     * Get the currently active theme
     * @returns {Theme} The active theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Start the current theme's animation
     */
    startCurrentTheme() {
        if (this.currentTheme) {
            this.currentTheme.start();
            return true;
        }
        return false;
    }

    /**
     * Stop the current theme's animation
     */
    stopCurrentTheme() {
        if (this.currentTheme) {
            this.currentTheme.stop();
            return true;
        }
        return false;
    }
}