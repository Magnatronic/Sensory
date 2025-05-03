/**
 * App configuration settings
 * Centralizes all configuration options for the application
 */

export const defaultConfig = {
  // Audio processing settings
  audio: {
    threshold: 0.05,
    smoothing: 0.8,
    cooldownTime: 300,
    calibrationDuration: 60,
    fftSize: 32
  },
  
  // Theme specific settings
  themes: {
    snowflakes: {
      defaultCount: 200,
      defaultSize: 10,
      defaultSpeed: 1,
      defaultColor: "#FFFFFF",
      defaultBackground: "#000A28",
      defaultWobbleIntensity: 0.5,
      burstIntensity: 20,
      burstSizeMultiplier: 1.5,
      colorVariation: 30
    }
  },
  
  // UI settings
  ui: {
    frameRate: 30,
    volumeMeterUpdateFrequency: 33
  }
};

/**
 * Settings manager class to handle saving/loading settings
 */
class SettingsManager {
  constructor(defaultSettings) {
    console.debug('⚙️ SettingsManager: Initializing with default settings', defaultSettings);
    this.defaultSettings = defaultSettings;
    const loaded = this.loadSettings();
    this.settings = loaded || JSON.parse(JSON.stringify(this.defaultSettings));
    
    if (loaded) {
      console.debug('⚙️ SettingsManager: Loaded settings from localStorage', this.settings);
    } else {
      console.debug('⚙️ SettingsManager: No saved settings found, using defaults');
    }
  }
  
  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      console.debug('⚙️ SettingsManager: Attempting to load settings from localStorage');
      const savedSettings = localStorage.getItem('sensoryAppSettings');
      if (!savedSettings) {
        console.debug('⚙️ SettingsManager: No settings found in localStorage');
        return null;
      }
      
      const parsedSettings = JSON.parse(savedSettings);
      console.debug('⚙️ SettingsManager: Successfully parsed settings from localStorage');
      return parsedSettings;
    } catch (e) {
      console.error('⚙️ SettingsManager: Error loading settings:', e);
      return null;
    }
  }
  
  /**
   * Save current settings to localStorage
   */
  saveSettings() {
    try {
      console.debug('⚙️ SettingsManager: Saving settings to localStorage', this.settings);
      localStorage.setItem('sensoryAppSettings', JSON.stringify(this.settings));
      console.debug('⚙️ SettingsManager: Settings saved successfully');
    } catch (e) {
      console.error('⚙️ SettingsManager: Error saving settings:', e);
    }
  }
  
  /**
   * Get a specific setting by path
   * @param {string} path - Dot-notation path to the setting (e.g. 'audio.threshold')
   * @param {any} defaultValue - Default value to return if setting doesn't exist
   * @returns {any} The setting value
   */
  get(path, defaultValue = null) {
    try {
      console.debug(`⚙️ SettingsManager: Getting setting "${path}"`);
      const parts = path.split('.');
      let value = this.settings;
      
      for (const part of parts) {
        if (value === undefined || value === null) {
          console.debug(`⚙️ SettingsManager: Path "${path}" not found, returning default:`, defaultValue);
          return defaultValue;
        }
        value = value[part];
      }
      
      const result = value !== undefined ? value : defaultValue;
      console.debug(`⚙️ SettingsManager: Retrieved "${path}" =`, result);
      return result;
    } catch (e) {
      console.error(`⚙️ SettingsManager: Error getting setting: ${path}`, e);
      return defaultValue;
    }
  }
  
  /**
   * Update a specific setting by path
   * @param {string} path - Dot-notation path to the setting (e.g. 'audio.threshold')
   * @param {any} value - New value to set
   */
  set(path, value) {
    try {
      console.debug(`⚙️ SettingsManager: Setting "${path}" =`, value);
      const parts = path.split('.');
      const lastPart = parts.pop();
      let current = this.settings;
      
      // Navigate to the correct object
      for (const part of parts) {
        if (!current[part]) {
          console.debug(`⚙️ SettingsManager: Creating missing object for "${part}" in path "${path}"`);
          current[part] = {};
        }
        current = current[part];
      }
      
      // Set the value
      current[lastPart] = value;
      console.debug(`⚙️ SettingsManager: Successfully set "${path}"`);
      
      // Save settings to persistence
      this.saveSettings();
    } catch (e) {
      console.error(`⚙️ SettingsManager: Error setting: ${path} to ${value}`, e);
    }
  }
  
  /**
   * Reset all settings to default
   */
  resetToDefault() {
    console.debug('⚙️ SettingsManager: Resetting all settings to default values');
    this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
    this.saveSettings();
    console.debug('⚙️ SettingsManager: Reset complete');
  }
  
  /**
   * Get the entire settings object
   */
  getAll() {
    console.debug('⚙️ SettingsManager: Returning full settings object');
    return JSON.parse(JSON.stringify(this.settings));
  }
}

// Export a singleton instance
export const settingsManager = new SettingsManager(defaultConfig);