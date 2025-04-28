/**
 * Main p5.js sketch file
 */

// Global variables
let canvas;
let themeManager;
let audioProcessor;
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

// Audio control variables
let micToggleButton;
let soundThresholdSlider;
let burstIntensitySlider;
let burstSizeSlider;
let colorVariationSlider;
let soundThresholdValue;
let burstIntensityValue;
let burstSizeValue;
let colorVariationValue;
let volumeMeter;
let volumeLevel;

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
  
  // Get audio control elements
  micToggleButton = document.getElementById('mic-toggle');
  soundThresholdSlider = document.getElementById('sound-threshold');
  burstIntensitySlider = document.getElementById('burst-intensity');
  burstSizeSlider = document.getElementById('burst-size');
  colorVariationSlider = document.getElementById('color-variation');
  soundThresholdValue = document.getElementById('sound-threshold-value');
  burstIntensityValue = document.getElementById('burst-intensity-value');
  burstSizeValue = document.getElementById('burst-size-value');
  colorVariationValue = document.getElementById('color-variation-value');
  volumeMeter = document.getElementById('volume-meter');
  volumeLevel = document.getElementById('volume-level');
  
  // Create canvas that fits the container
  canvas = createCanvas(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
  canvas.parent('canvas-container');
  
  // Initialize theme manager
  themeManager = new ThemeManager();
  
  // Initialize audio processor
  audioProcessor = new AudioProcessor();
  
  // Set initial threshold based on slider value (important to do this early)
  const initialThresholdValue = parseInt(soundThresholdSlider.value);
  const normalizedThreshold = (100 - initialThresholdValue) / 100 * 0.2;
  audioProcessor.setThreshold(normalizedThreshold);
  
  // Register available themes
  themeManager.registerTheme('snowflakes', new SnowflakesTheme());
  
  // Initialize all themes
  themeManager.initThemes(this);
  
  // Switch to initial theme
  themeManager.switchTheme('snowflakes');
  
  // Set up audio detection callback
  setupAudioDetection();
  
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
  
  // Update audio processor
  if (audioProcessor && audioProcessor.isEnabled) {
    const volume = audioProcessor.update();
    updateVolumeMeter(volume);
  }
}

/**
 * Set up audio detection and link it to the theme
 */
function setupAudioDetection() {
  // Set up callback for when a sound is detected
  audioProcessor.onSoundDetected((intensity) => {
    // Get the current theme and create a burst if it's a snowflakes theme
    const currentTheme = themeManager.getCurrentTheme();
    if (currentTheme && themeManager.activeThemeId === 'snowflakes' && currentTheme.isRunning) {
      // Generate a burst at a random position
      const x = random(width * 0.1, width * 0.9);
      const y = random(height * 0.1, height * 0.9);
      currentTheme.createSnowflakeBurst(x, y);
    }
  });
}

/**
 * Update the volume meter visual
 */
function updateVolumeMeter(volume) {
  if (!volumeLevel) return;
  
  // Map volume (0-1) to meter width (0-100%)
  const percentage = Math.min(100, volume * 100 * 2); // Multiply by 2 to make it more visible
  volumeLevel.style.width = percentage + '%';
  
  // Add color classes based on volume
  if (percentage > 80) {
    volumeLevel.className = 'high';
  } else if (percentage > 40) {
    volumeLevel.className = 'medium';
  } else {
    volumeLevel.className = 'low';
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
  
  // Listen for fullscreen change event
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  
  // Snowflake controls
  snowflakeCountSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    snowflakeCountValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setNumberOfSnowflakes(value);
    }
  });
  
  snowflakeSizeSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    snowflakeSizeValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setSizeMultiplier(value / 10); // Convert to a reasonable multiplier
    }
  });
  
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
  
  // Audio Controls
  
  // Microphone toggle button
  micToggleButton.addEventListener('click', async () => {
    if (!audioProcessor.isEnabled) {
      // Try to start the microphone
      const success = await audioProcessor.start();
      if (success) {
        micToggleButton.textContent = 'Disable Microphone';
        micToggleButton.classList.add('active');
      } else {
        alert('Could not access the microphone. Please check your browser permissions.');
      }
    } else {
      // Stop the microphone
      audioProcessor.stop();
      micToggleButton.textContent = 'Enable Microphone';
      micToggleButton.classList.remove('active');
      // Reset volume meter
      if (volumeLevel) volumeLevel.style.width = '0%';
    }
  });
  
  // Sound threshold slider
  soundThresholdSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    soundThresholdValue.textContent = value;
    
    // Reverse the scale so higher slider values = higher sensitivity
    // 100 = most sensitive (low threshold), 0 = least sensitive (high threshold)
    const reversedValue = (100 - value) / 100;
    audioProcessor.setThreshold(reversedValue);
  });
  
  // Burst intensity slider
  burstIntensitySlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    burstIntensityValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setBurstIntensity(value);
    }
  });
  
  // Burst size slider
  burstSizeSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    const multiplier = value / 10;
    burstSizeValue.textContent = multiplier.toFixed(1);
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setBurstSizeMultiplier(multiplier);
    }
  });
  
  // Color variation slider
  colorVariationSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    colorVariationValue.textContent = value;
    
    const snowflakesTheme = themeManager.getTheme('snowflakes');
    if (snowflakesTheme && themeManager.activeThemeId === 'snowflakes') {
      snowflakesTheme.setBurstColorVariation(value);
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