/**
 * ThemeManager class to handle theme selection and switching
 */
import { eventBus } from '../core/event-bus.js';
import { stateMachine, AppStates } from '../core/state-machine.js';
import { settingsManager } from '../core/app-config.js';

export class ThemeManager {
    constructor() {
        this.themes = {};
        this.currentTheme = null;
        this.activeThemeId = null;
        this.themeReady = false;
    }

    /**
     * Register a theme with the theme manager
     * @param {string} id - Unique identifier for the theme
     * @param {Theme} theme - An instance of a Theme-derived class
     */
    registerTheme(id, theme) {
        this.themes[id] = theme;
        eventBus.emit('theme-registered', { id, theme });
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
            try {
                this.themes[id].init(canvas);
                console.log(`Theme initialized: ${id}`);
            } catch (error) {
                console.error(`Error initializing theme: ${id}`, error);
            }
        }
        
        this.themeReady = true;
        eventBus.emit('themes-initialized');
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

        // Store the old theme ID for the event
        const oldThemeId = this.activeThemeId;

        // Stop and cleanup current theme if there is one
        if (this.currentTheme) {
            this.currentTheme.stop();
            this.currentTheme.cleanup();
        }

        // Set new theme as current
        this.currentTheme = newTheme;
        this.activeThemeId = id;
        
        // Save the selected theme in settings
        settingsManager.set('activeTheme', id);
        
        // Emit theme changed event
        eventBus.emit('theme-changed', { 
            newThemeId: id, 
            oldThemeId, 
            theme: newTheme 
        });
        
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
            const result = this.currentTheme.start();
            if (result) {
                stateMachine.transition(AppStates.RUNNING, { themeId: this.activeThemeId });
                eventBus.emit('theme-started', { themeId: this.activeThemeId });
            }
            return result;
        }
        return false;
    }

    /**
     * Stop the current theme's animation
     */
    stopCurrentTheme() {
        if (this.currentTheme) {
            const result = this.currentTheme.stop();
            if (result) {
                stateMachine.transition(AppStates.PAUSED);
                eventBus.emit('theme-stopped', { themeId: this.activeThemeId });
            }
            return result;
        }
        return false;
    }

    /**
     * Load a theme asynchronously (lazy loading)
     * @param {string} themeId - The theme ID to load
     * @returns {Promise} Promise that resolves when theme is loaded
     */
    async loadTheme(themeId) {
        // If theme already loaded, return it
        if (this.themes[themeId]) {
            return this.themes[themeId];
        }

        try {
            // Dynamic import based on theme id
            const module = await import(`./${themeId}/${themeId}.js`);
            const ThemeClass = module.default;
            
            // Instantiate and register
            const theme = new ThemeClass();
            this.registerTheme(themeId, theme);
            
            return theme;
        } catch (error) {
            console.error(`Failed to load theme: ${themeId}`, error);
            return null;
        }
    }
}

// Create and export a singleton instance of ThemeManager
export const themeManager = new ThemeManager();