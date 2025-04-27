/**
 * Main p5.js sketch file
 */

// Global variables
let canvas;
let themeManager;
let startButton;
let stopButton;
let themeSelect;
let canvasContainer;
let fullscreenButton;
let isFullscreen = false;

// Slider control variables
let snowflakeCountSlider;
let snowflakeSizeSlider;
let snowflakeSpeedSlider;
let snowflakeCountValue;
let snowflakeSizeValue;
let snowflakeSpeedValue;

// Color picker variables
let backgroundColorPicker;
let snowflakeColorPicker;

// New control variables for wobble and wind
let wobbleIntensitySlider;
let windStrengthSlider;
let windDirectionSlider;
let wobbleIntensityValue;
let windStrengthValue;
let windDirectionValue;

/**
 * p5.js setup function - runs once at the start
 */
function setup() {
  // Get DOM elements
  canvasContainer = document.getElementById('canvas-container');
  startButton = document.getElementById('start-btn');
  stopButton = document.getElementById('stop-btn');
  themeSelect = document.getElementById('theme-select');
  fullscreenButton = document.getElementById('fullscreen-btn');
  
  // Get slider elements
  snowflakeCountSlider = document.getElementById('snowflake-count');
  snowflakeSizeSlider = document.getElementById('snowflake-size');
  snowflakeSpeedSlider = document.getElementById('snowflake-speed');
  snowflakeCountValue = document.getElementById('snowflake-count-value');
  snowflakeSizeValue = document.getElementById('snowflake-size-value');
  snowflakeSpeedValue = document.getElementById('snowflake-speed-value');
  
  // Get new slider elements for wobble and wind
  wobbleIntensitySlider = document.getElementById('wobble-intensity');
  windStrengthSlider = document.getElementById('wind-strength');
  windDirectionSlider = document.getElementById('wind-direction');
  wobbleIntensityValue = document.getElementById('wobble-intensity-value');
  windStrengthValue = document.getElementById('wind-strength-value');
  windDirectionValue = document.getElementById('wind-direction-value');
  
  // Get color picker elements
  backgroundColorPicker = document.getElementById('background-color');
  snowflakeColorPicker = document.getElementById('snowflake-color');
  
  // Create canvas that fits the container
  canvas = createCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
  canvas.parent('canvas-container');
  
  // Initialize theme manager
  themeManager = new ThemeManager();
  
  // Register available themes
  themeManager.registerTheme('snowflakes', new SnowflakesTheme());
  
  // Initialize all themes
  themeManager.initThemes(this);
  
  // Switch to initial theme
  themeManager.switchTheme('snowflakes');
  
  // Add event listeners
  setupEventListeners();
  
  // Set frame rate to 30 for smooth animation without being too resource intensive
  frameRate(30);
}

/**
 * p5.js draw function - runs continuously after setup
 */
function draw() {
  const currentTheme = themeManager.getCurrentTheme();
  
  if (currentTheme) {
    // Update and draw the current theme
    currentTheme.update();
    currentTheme.draw();
  }
}

/**
 * p5.js windowResized function - runs when window is resized
 */
function windowResized() {
  // Resize canvas to fit container
  if (isFullscreen) {
    // In fullscreen mode, use window dimensions directly
    resizeCanvas(window.innerWidth, window.innerHeight);
  } else {
    // In normal mode, use container dimensions
    resizeCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
  }
}

/**
 * Toggle fullscreen mode
 */
function toggleFullScreen() {
  if (!isFullscreen) {
    // If browser supports native fullscreen API
    if (canvasContainer.requestFullscreen) {
      canvasContainer.requestFullscreen();
    } else if (canvasContainer.webkitRequestFullscreen) { // Safari
      canvasContainer.webkitRequestFullscreen();
    } else if (canvasContainer.msRequestFullscreen) { // IE11
      canvasContainer.msRequestFullscreen();
    }

    // Add fullscreen class for CSS styling
    document.body.classList.add('fullscreen-active');
    fullscreenButton.textContent = "Exit Full Screen";
    
    // Set flag before resizing
    isFullscreen = true;
    
    // Force immediate resize to fill the screen
    setTimeout(() => {
      resizeCanvas(window.innerWidth, window.innerHeight);
    }, 100);
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { // Safari
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE11
      document.msExitFullscreen();
    }

    // Remove fullscreen class
    document.body.classList.remove('fullscreen-active');
    fullscreenButton.textContent = "Full Screen";
    
    // Set flag before resizing
    isFullscreen = false;
    
    // Allow time for transition before resizing
    setTimeout(() => {
      resizeCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
    }, 100);
  }
}

/**
 * Setup all event listeners for UI controls
 */
function setupEventListeners() {
  // Start button
  startButton.addEventListener('click', () => {
    themeManager.startCurrentTheme();
    startButton.disabled = true;
    stopButton.disabled = false;
  });
  
  // Stop button
  stopButton.addEventListener('click', () => {
    themeManager.stopCurrentTheme();
    stopButton.disabled = true;
    startButton.disabled = false;
  });
  
  // Theme select
  themeSelect.addEventListener('change', (event) => {
    const themeId = event.target.value;
    const wasRunning = themeManager.getCurrentTheme() && themeManager.getCurrentTheme().isRunning;
    
    themeManager.switchTheme(themeId);
    
    // If the previous theme was running, start the new one
    if (wasRunning) {
      themeManager.startCurrentTheme();
    }
  });
  
  // Fullscreen button
  fullscreenButton.addEventListener('click', toggleFullScreen);
  
  // Listen for fullscreen change event to handle browser's ESC key exit
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  
  // Snowflake count slider
  snowflakeCountSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    snowflakeCountValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setNumberOfSnowflakes(value);
    }
  });
  
  // Snowflake size slider
  snowflakeSizeSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    snowflakeSizeValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setSizeMultiplier(value / 10); // Convert to a reasonable multiplier
    }
  });
  
  // Snowflake speed slider
  snowflakeSpeedSlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    snowflakeSpeedValue.textContent = value.toFixed(1);
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setSpeedMultiplier(value);
    }
  });
  
  // Background color picker
  backgroundColorPicker.addEventListener('input', (event) => {
    const hexColor = event.target.value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setBackgroundColor(hexColor);
    }
  });
  
  // Snowflake color picker
  snowflakeColorPicker.addEventListener('input', (event) => {
    const hexColor = event.target.value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setSnowflakeColor(hexColor);
    }
  });
  
  // Wobble intensity slider
  wobbleIntensitySlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    wobbleIntensityValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      // Convert range 0-10 to an appropriate intensity value 0-1
      const intensity = value / 10;
      snowflakesTheme.setWobbleIntensity(intensity);
    }
  });
  
  // Wind strength slider
  windStrengthSlider.addEventListener('input', (event) => {
    const strength = parseInt(event.target.value);
    windStrengthValue.textContent = strength;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      // Direction doesn't change, just update the strength
      const direction = parseInt(windDirectionSlider.value);
      snowflakesTheme.setWind(strength, direction);
    }
  });
  
  // Wind direction slider
  windDirectionSlider.addEventListener('input', (event) => {
    const direction = parseInt(event.target.value);
    windDirectionValue.textContent = direction + '°';
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      // Strength doesn't change, just update the direction
      const strength = parseInt(windStrengthSlider.value);
      snowflakesTheme.setWind(strength, direction);
    }
  });
}

/**
 * Handle fullscreen change event (for when user presses ESC to exit)
 */
function handleFullscreenChange() {
  // Check if we're in fullscreen mode
  const fullscreenElement = document.fullscreenElement || 
                document.webkitFullscreenElement || 
                document.mozFullScreenElement ||
                document.msFullscreenElement;
  
  isFullscreen = !!fullscreenElement;
  
  if (!isFullscreen) {
    // Update button text and remove class
    document.body.classList.remove('fullscreen-active');
    fullscreenButton.textContent = "Full Screen";
    
    // Resize with a small delay to ensure container has settled
    setTimeout(() => {
      resizeCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
    }, 100);
  } else {
    document.body.classList.add('fullscreen-active');
    fullscreenButton.textContent = "Exit Full Screen";
    
    // Resize with a small delay to ensure fullscreen is complete
    setTimeout(() => {
      resizeCanvas(window.innerWidth, window.innerHeight);
    }, 100);
  }
}