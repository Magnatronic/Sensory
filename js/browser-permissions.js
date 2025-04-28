/**
 * Browser-specific permissions handling
 * This file handles microphone permissions in different browsers
 */

const BrowserPermissions = {
    // Better browser detection
    isEdge: navigator.userAgent.indexOf("Edg") !== -1 || navigator.userAgent.indexOf("Edge") !== -1,
    isChrome: (navigator.userAgent.indexOf("Chrome") !== -1) && 
              (navigator.userAgent.indexOf("Edg") === -1) && 
              (navigator.userAgent.indexOf("Edge") === -1),
    isFirefox: navigator.userAgent.indexOf("Firefox") !== -1,
    
    // Store permission state
    microphonePermissionGranted: false,
    
    // Initialize on load
    init: function() {
        console.log(`BrowserPermissions: Browser detected: ${this.isEdge ? 'Microsoft Edge' : this.isChrome ? 'Chrome' : this.isFirefox ? 'Firefox' : 'Other browser'}`);
        console.log("BrowserPermissions: Full user agent:", navigator.userAgent);
        
        // Make browser info globally available
        window.isMicrosoftEdge = this.isEdge;
        window.isChromeBrowser = this.isChrome;
        window.isFirefoxBrowser = this.isFirefox;
        
        // Debug permission API availability
        if (navigator.permissions) {
            console.log("BrowserPermissions: Permissions API is available");
        } else {
            console.warn("BrowserPermissions: Permissions API is not available in this browser");
        }
        
        // Debug getUserMedia API availability
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            console.log("BrowserPermissions: getUserMedia API is available");
        } else {
            console.warn("BrowserPermissions: getUserMedia API is not available in this browser");
        }
    },
    
    /**
     * Request microphone permission directly
     * @returns {Promise<boolean>} True if permission granted
     */
    requestMicrophonePermission: async function() {
        console.log("BrowserPermissions: 📢 ATTEMPTING TO REQUEST MICROPHONE PERMISSION DIRECTLY");
        try {
            console.log("BrowserPermissions: Starting getUserMedia request for audio...");
            
            // Force the browser to show the permission dialog
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false // Explicitly set to false
            });
            
            console.log("BrowserPermissions: ✅ Microphone permission GRANTED!");
            console.log("BrowserPermissions: Stream active:", stream.active);
            console.log("BrowserPermissions: Audio tracks:", stream.getAudioTracks().length);
            if (stream.getAudioTracks().length > 0) {
                console.log("BrowserPermissions: First audio track:", stream.getAudioTracks()[0].label);
            }
            
            this.microphonePermissionGranted = true;
            
            // Keep the stream reference to ensure permission stays active
            this.microphoneStream = stream;
            
            // Make this accessible for p5.sound to use
            window.edgeAudioStream = stream;
            
            return true;
        } catch (err) {
            console.error("BrowserPermissions: ❌ ERROR requesting microphone permission:", err);
            console.error("BrowserPermissions: Error name:", err.name);
            console.error("BrowserPermissions: Error message:", err.message);
            
            // Check if it's a permission error
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                console.log("BrowserPermissions: This is a permission denial error, showing error dialog");
                this.showPermissionError();
            } else if (err.name === 'NotFoundError') {
                console.log("BrowserPermissions: No microphone found on this device");
                alert("No microphone was found on this device. Please connect a microphone and try again.");
            } else {
                console.log("BrowserPermissions: Other type of error occurred with getUserMedia");
            }
            
            return false;
        }
    },
    
    /**
     * Check if microphone permission has been granted
     * @returns {Promise<string>} Permission state: 'granted', 'denied', 'prompt'
     */
    checkMicrophonePermission: async function() {
        try {
            const permResult = await navigator.permissions.query({ name: 'microphone' });
            console.log("BrowserPermissions: Microphone permission state:", permResult.state);
            return permResult.state;
        } catch (err) {
            console.warn("BrowserPermissions: Could not check permission status:", err);
            return 'unknown';
        }
    },
    
    /**
     * Show a permission error dialog with instructions
     */
    showPermissionError: function() {
        const overlay = document.createElement('div');
        overlay.className = 'permission-overlay';
        overlay.innerHTML = `
            <div class="permission-box">
                <h3>Microphone Access Denied</h3>
                <p>Your browser has denied access to the microphone. Without microphone access, sound detection cannot work.</p>
                <p>To fix this in ${this.isEdge ? 'Microsoft Edge' : this.isChrome ? 'Chrome' : 'Firefox'}:</p>
                <ol>
                    <li>Click the ${this.isEdge || this.isChrome ? 'padlock or camera icon' : 'information icon'} in the address bar</li>
                    <li>Find "Microphone" in the site settings</li>
                    <li>Change the setting to "Allow"</li>
                    <li>Refresh this page</li>
                </ol>
                <button id="close-permission-error">Close</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        document.getElementById('close-permission-error').onclick = function() {
            overlay.remove();
        };
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    console.log("BrowserPermissions: DOMContentLoaded event fired");
    BrowserPermissions.init();
});