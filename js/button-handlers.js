document.addEventListener('DOMContentLoaded', function() {
    // Get references to UI elements
    const startButton = document.getElementById('start-btn');
    const stopButton = document.getElementById('stop-btn');
    const fullscreenButton = document.getElementById('fullscreen-btn');
    const micToggleButton = document.getElementById('mic-toggle');
    const themeSelect = document.getElementById('theme-select');
    const soundThreshold = document.getElementById('sound-threshold');
    const soundThresholdValue = document.getElementById('sound-threshold-value');
    const burstIntensity = document.getElementById('burst-intensity');
    const burstIntensityValue = document.getElementById('burst-intensity-value');
    
    // Check if we're in Microsoft Edge
    const isEdge = navigator.userAgent.indexOf("Edg") !== -1 || navigator.userAgent.indexOf("Edge") !== -1;
    
    console.log("button-handlers.js loaded, detected browser:", isEdge ? "Microsoft Edge" : "Other browser");
    
    // Create Edge audio processor if needed
    if (isEdge) {
        window.edgeAudioProcessor = new EdgeAudioProcessor();
        console.log("Created EdgeAudioProcessor for Microsoft Edge");
    }
    
    // Function to set up all event listeners
    function setupEventListeners() {
        console.log('Setting up button event listeners');
        
        // Add microphone button handler
        micToggleButton.onclick = async function() {
            console.log('Microphone button clicked');
            
            // For Edge, use the custom EdgeAudioProcessor
            if (isEdge && window.edgeAudioProcessor) {
                console.log("Using EdgeAudioProcessor for Microsoft Edge");
                
                if (!window.edgeAudioProcessor.isEnabled) {
                    console.log('Attempting to enable EdgeAudioProcessor');
                    micToggleButton.textContent = 'Enabling Microphone...';
                    
                    // Start the Edge audio processor
                    const success = await window.edgeAudioProcessor.start();
                    
                    if (success) {
                        console.log('Edge microphone enabled');
                        micToggleButton.textContent = 'Disable Microphone';
                        micToggleButton.classList.add('active');
                        
                        // Set up the sound detection callback
                        window.edgeAudioProcessor.onSoundDetected(function(intensity) {
                            console.log(`Edge detected sound! Intensity: ${intensity}`);
                            
                            // Add debug info about ThemeManager
                            console.log(`ThemeManager available: ${window.themeManager ? 'YES' : 'NO'}`);
                            
                            // Access ThemeManager from the global scope
                            if (window.themeManager) {
                                console.log(`Forwarding sound to ThemeManager with intensity: ${intensity}`);
                                window.themeManager.onSoundDetected(intensity);
                            } else {
                                console.error("ThemeManager not available globally. Sound detection failed.");
                            }
                        });
                        
                        // Set initial threshold from the slider
                        if (soundThreshold) {
                            const value = parseFloat(soundThreshold.value) / 100;
                            window.edgeAudioProcessor.setThreshold(value);
                        }
                    } else {
                        console.log('Failed to enable Edge microphone');
                        micToggleButton.textContent = 'Enable Microphone';
                        alert('Could not access the microphone in Microsoft Edge. Please check your browser permissions.');
                    }
                } else {
                    console.log('Disabling Edge microphone');
                    window.edgeAudioProcessor.stop();
                    micToggleButton.textContent = 'Enable Microphone';
                    micToggleButton.classList.remove('active');
                    
                    // Reset volume meter if present
                    const volumeLevel = document.getElementById('volume-level');
                    if (volumeLevel) volumeLevel.style.width = '0%';
                }
                
                return; // Skip the regular audio processor for Edge
            }
            
            // Regular p5.sound audio processor for other browsers
            if (window.audioProcessor) {
                if (!window.audioProcessor.isEnabled) {
                    console.log('Attempting to enable microphone');
                    micToggleButton.textContent = 'Enabling Microphone...';
                    
                    const success = await window.audioProcessor.start();
                    if (success) {
                        console.log('Microphone enabled');
                        micToggleButton.textContent = 'Disable Microphone';
                        micToggleButton.classList.add('active');
                    } else {
                        console.log('Failed to enable microphone');
                        micToggleButton.textContent = 'Enable Microphone';
                        alert('Could not access the microphone. Please check your browser permissions.');
                    }
                } else {
                    console.log('Disabling microphone');
                    window.audioProcessor.stop();
                    micToggleButton.textContent = 'Enable Microphone';
                    micToggleButton.classList.remove('active');
                    
                    // Reset volume meter if present
                    const volumeLevel = document.getElementById('volume-level');
                    if (volumeLevel) volumeLevel.style.width = '0%';
                }
            } else {
                console.error('Audio processor not available');
                alert('Audio system not initialized properly. Try refreshing the page.');
            }
        };
        
        // Add sound threshold slider handler
        if (soundThreshold && soundThresholdValue) {
            soundThreshold.oninput = function() {
                const value = parseFloat(this.value);
                soundThresholdValue.textContent = value;
                
                // For Edge, use the Edge-specific processor
                if (isEdge && window.edgeAudioProcessor) {
                    window.edgeAudioProcessor.setThreshold(value / 100);
                } else if (window.audioProcessor) {
                    window.audioProcessor.setThreshold(value / 100);
                }
            };
        }
        
        // Add burst intensity slider handler
        if (burstIntensity && burstIntensityValue) {
            burstIntensity.oninput = function() {
                const value = parseInt(this.value);
                burstIntensityValue.textContent = value;
                
                if (window.themeManager) {
                    window.themeManager.setBurstIntensity(value);
                }
            };
        }
        
        // Add other existing handlers...
    }
    
    // Set up volume meter updates
    function setupVolumeMeter() {
        const volumeLevel = document.getElementById('volume-level');
        if (!volumeLevel) return;
        
        // Update volume meter every 100ms
        setInterval(() => {
            let level = 0;
            
            // For Edge, use the Edge-specific processor
            if (isEdge && window.edgeAudioProcessor && window.edgeAudioProcessor.isEnabled) {
                level = window.edgeAudioProcessor.getCurrentLevel() * 100;
            } else if (window.audioProcessor && window.audioProcessor.isEnabled) {
                level = window.audioProcessor.getCurrentLevel() * 100;
            }
            
            // Update volume level display
            volumeLevel.style.width = Math.min(100, level) + '%';
            
            // Update class for color
            volumeLevel.className = '';
            if (level > 80) {
                volumeLevel.classList.add('high');
            } else if (level > 30) {
                volumeLevel.classList.add('medium');
            } else {
                volumeLevel.classList.add('low');
            }
        }, 100);
    }
    
    // Initial setup
    setupEventListeners();
    setupVolumeMeter();
});