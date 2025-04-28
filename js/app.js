/**
 * Main application entry point
 * This file initializes the application when the document loads
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Music Therapy Sensory App initialized');
    
    // Add any application-wide initialization here
    
    // Note: p5.js will automatically run the setup() and draw() functions
    // defined in sketch.js once the p5.js library is loaded
    
    // Audio Reactivity Controls
    const micToggle = document.getElementById('mic-toggle');
    const audioSensitivity = document.getElementById('audio-sensitivity');
    const audioSensitivityValue = document.getElementById('audio-sensitivity-value');
    const burstThreshold = document.getElementById('burst-threshold');
    const burstThresholdValue = document.getElementById('burst-threshold-value');
    const audioWind = document.getElementById('audio-wind');
    const audioColor = document.getElementById('audio-color');
    const audioBurst = document.getElementById('audio-burst');
    const audioSize = document.getElementById('audio-size');
    
    // Initialize audio sensitivity slider display
    audioSensitivityValue.textContent = audioSensitivity.value;
    burstThresholdValue.textContent = burstThreshold.value;
    
    // Toggle microphone on/off
    micToggle.addEventListener('click', function() {
        const currentTheme = themeManager.getCurrentTheme();
        
        if (micToggle.classList.contains('active')) {
            // Disable microphone
            micToggle.classList.remove('active');
            micToggle.textContent = 'Enable Microphone';
            
            if (currentTheme && typeof currentTheme.stopAudio === 'function') {
                currentTheme.stopAudio();
            }
        } else {
            // Enable microphone (ask for user permission)
            if (currentTheme && typeof currentTheme.startAudio === 'function') {
                // Request user permission for microphone access
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function(stream) {
                        // Permission granted
                        micToggle.classList.add('active');
                        micToggle.textContent = 'Disable Microphone';
                        currentTheme.startAudio();
                    })
                    .catch(function(err) {
                        // Permission denied or error
                        console.error('Microphone access error:', err);
                        alert('Please allow microphone access to enable audio reactivity.');
                    });
            }
        }
    });
    
    // Audio sensitivity slider
    audioSensitivity.addEventListener('input', function() {
        const value = this.value;
        audioSensitivityValue.textContent = value;
        
        const currentTheme = themeManager.getCurrentTheme();
        if (currentTheme && typeof currentTheme.setAudioSensitivity === 'function') {
            currentTheme.setAudioSensitivity(parseInt(value));
        }
    });
    
    // Burst sensitivity slider
    burstThreshold.addEventListener('input', function() {
        const value = this.value;
        burstThresholdValue.textContent = value;
        
        const currentTheme = themeManager.getCurrentTheme();
        if (currentTheme && typeof currentTheme.setBurstSensitivity === 'function') {
            currentTheme.setBurstSensitivity(parseInt(value));
        }
    });
    
    // Audio effect toggles
    const updateAudioEffects = function() {
        const currentTheme = themeManager.getCurrentTheme();
        if (currentTheme && typeof currentTheme.setAudioEffectToggles === 'function') {
            currentTheme.setAudioEffectToggles(
                audioWind.checked,
                audioColor.checked,
                audioBurst.checked,
                audioSize.checked
            );
        }
    };
    
    audioWind.addEventListener('change', updateAudioEffects);
    audioColor.addEventListener('change', updateAudioEffects);
    audioBurst.addEventListener('change', updateAudioEffects);
    audioSize.addEventListener('change', updateAudioEffects);
});