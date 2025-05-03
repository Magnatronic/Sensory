/**
 * Edge Audio Fix - Special handling for Microsoft Edge browser
 * Addresses known issues with Web Audio API in Microsoft Edge
 */
import { eventBus } from '../core/event-bus.js';

// Debug configuration
const DEBUG = {
  EDGE_DETECTION: true,  // Log Edge browser detection
  FIXES_APPLIED: true,   // Log when fixes are applied
  API_PATCHING: true,    // Log API patching operations
  CALLBACKS: true,       // Log callback executions
  VERBOSE: false         // Enable for very detailed logs
};

// Helper function for consistent debug logging
function debugLog(category, message, data = null) {
  if (!DEBUG[category]) return;
  
  const timestamp = new Date().toISOString().substr(11, 8); // HH:MM:SS
  const prefix = `[EdgeAudioFix][${timestamp}][${category}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export class EdgeAudioFix {
  constructor() {
    this.isEdge = this.detectEdgeBrowser();
    this.fixesApplied = false;
    this.originalMethods = {};
    
    // Browser flags for specific Edge versions
    this.edgeDetails = {
      isChromiumBased: false,
      legacyEdge: false,
      version: null,
      needsAudioSourceFix: false,
      needsAnalyzerFix: false
    };
    
    // Initialize with detailed detection
    this.detectBrowserDetails();
  }
  
  /**
   * Detect if running in any version of Microsoft Edge
   */
  detectEdgeBrowser() {
    debugLog('EDGE_DETECTION', 'Checking if browser is Microsoft Edge');
    
    const userAgent = navigator.userAgent;
    const isEdgeHTML = userAgent.indexOf('Edge/') !== -1;
    const isEdgeChromium = userAgent.indexOf('Edg/') !== -1;
    
    const isEdge = isEdgeHTML || isEdgeChromium;
    
    if (isEdge) {
      debugLog('EDGE_DETECTION', `Detected Microsoft Edge browser`, {
        userAgent,
        isEdgeHTML,
        isEdgeChromium
      });
    } else {
      debugLog('EDGE_DETECTION', 'Not running in Microsoft Edge');
    }
    
    return isEdge;
  }
  
  /**
   * Detect specific Edge version and features needing fixes
   */
  detectBrowserDetails() {
    if (!this.isEdge) return;
    
    const userAgent = navigator.userAgent;
    debugLog('EDGE_DETECTION', 'Analyzing Edge browser details', { userAgent });
    
    // Check if it's Chromium-based Edge or Legacy Edge
    if (userAgent.indexOf('Edg/') !== -1) {
      this.edgeDetails.isChromiumBased = true;
      
      // Extract version from format "Edg/91.0.864.59"
      const matches = userAgent.match(/Edg\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);
      if (matches && matches.length >= 5) {
        this.edgeDetails.version = {
          major: parseInt(matches[1], 10),
          minor: parseInt(matches[2], 10),
          build: parseInt(matches[3], 10),
          revision: parseInt(matches[4], 10)
        };
        
        debugLog('EDGE_DETECTION', `Detected Chromium-based Edge version:`, this.edgeDetails.version);
        
        // Check if this version needs fixes (primarily for older versions)
        if (this.edgeDetails.version.major < 90) {
          debugLog('EDGE_DETECTION', 'This version may have analyzer timing issues');
          this.edgeDetails.needsAnalyzerFix = true;
        }
      }
    } else if (userAgent.indexOf('Edge/') !== -1) {
      this.edgeDetails.legacyEdge = true;
      
      // Extract version from format "Edge/17.17134"
      const matches = userAgent.match(/Edge\/([0-9]+)\.([0-9]+)/);
      if (matches && matches.length >= 3) {
        this.edgeDetails.version = {
          major: parseInt(matches[1], 10),
          build: parseInt(matches[2], 10)
        };
        
        debugLog('EDGE_DETECTION', `Detected Legacy Edge version:`, this.edgeDetails.version);
        
        // Legacy Edge had multiple audio issues
        this.edgeDetails.needsAudioSourceFix = true;
        this.edgeDetails.needsAnalyzerFix = true;
        
        debugLog('EDGE_DETECTION', 'This version requires both source and analyzer fixes');
      }
    }
    
    // Log detection result
    debugLog('EDGE_DETECTION', 'Edge browser detection complete', {
      ...this.edgeDetails
    });
    
    eventBus.emit('edge-detection-complete', {
      isEdge: this.isEdge,
      details: {...this.edgeDetails}
    });
  }
  
  /**
   * Apply all necessary fixes for Edge browser
   * @returns {boolean} Whether fixes were applied
   */
  applyFixes() {
    if (!this.isEdge) {
      debugLog('FIXES_APPLIED', 'Not applying fixes: Not running in Microsoft Edge');
      return false;
    }
    
    if (this.fixesApplied) {
      debugLog('FIXES_APPLIED', 'Fixes already applied, skipping');
      return true;
    }
    
    debugLog('FIXES_APPLIED', 'Applying Edge-specific audio fixes', this.edgeDetails);
    
    if (this.edgeDetails.needsAudioSourceFix) {
      this.fixAudioSourceConnect();
    }
    
    if (this.edgeDetails.needsAnalyzerFix) {
      this.fixAnalyzerNode();
    }
    
    this.setupPerformanceMonitoring();
    
    this.fixesApplied = true;
    debugLog('FIXES_APPLIED', 'Edge audio fixes applied successfully');
    
    eventBus.emit('edge-fixes-applied', {
      fixes: {
        audioSource: this.edgeDetails.needsAudioSourceFix,
        analyzer: this.edgeDetails.needsAnalyzerFix
      }
    });
    
    console.log(`Microsoft Edge detected. Browser-specific audio optimizations applied.`);
    return true;
  }
  
  /**
   * Fix for Edge issues with MediaStreamSourceNode.connect() method
   */
  fixAudioSourceConnect() {
    debugLog('API_PATCHING', 'Applying MediaStreamSourceNode.connect() fix');
    
    if (!window.AudioContext) {
      debugLog('API_PATCHING', 'Web Audio API not available, cannot apply fix');
      return;
    }
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      
      if (!audioContext.createMediaStreamSource) {
        debugLog('API_PATCHING', 'createMediaStreamSource method not available');
        return;
      }
      
      // Original prototype to reference in case we need to revert
      const originalPrototype = AudioContext.prototype.createMediaStreamSource;
      this.originalMethods.createMediaStreamSource = originalPrototype;
      
      // Patch the createMediaStreamSource method
      AudioContext.prototype.createMediaStreamSource = function(stream) {
        debugLog('API_PATCHING', 'Intercepted createMediaStreamSource call');
        
        const originalSource = originalPrototype.call(this, stream);
        
        // Store original connect method
        const originalConnect = originalSource.connect;
        
        // Override connect method with added error handling and retries
        originalSource.connect = function(destination) {
          debugLog('API_PATCHING', 'Intercepted MediaStreamSourceNode.connect() call');
          
          try {
            return originalConnect.call(this, destination);
          } catch (err) {
            debugLog('API_PATCHING', 'Error in MediaStreamSourceNode.connect(), applying workaround', err);
            console.warn('Edge audio connect() error, applying workaround:', err);
            
            // Edge-specific workaround for connect issues
            // Try with a small delay
            setTimeout(() => {
              try {
                originalConnect.call(this, destination);
                debugLog('API_PATCHING', 'Delayed connect successful');
              } catch (retryErr) {
                debugLog('API_PATCHING', 'Delayed connect failed', retryErr);
                console.error('Edge audio connect retry failed:', retryErr);
                
                // Notify application of critical error
                eventBus.emit('audio-critical-error', {
                  message: 'Failed to connect audio source after retry',
                  error: retryErr
                });
              }
            }, 50);
            
            // Return destination to maintain API compatibility
            return destination;
          }
        };
        
        debugLog('API_PATCHING', 'MediaStreamSourceNode connect method patched');
        return originalSource;
      };
      
      // Clean up context used for patching
      audioContext.close();
      
      debugLog('API_PATCHING', 'MediaStreamSourceNode connect fix successfully applied');
    } catch (err) {
      debugLog('API_PATCHING', 'Error applying MediaStreamSourceNode fix:', err);
      console.error('Failed to apply Edge audio source fix:', err);
      
      // Notify application that the fix failed
      eventBus.emit('edge-fix-failed', {
        fix: 'audioSource',
        error: err
      });
    }
  }
  
  /**
   * Fix for Edge issues with AnalyserNode timing and performance
   */
  fixAnalyzerNode() {
    debugLog('API_PATCHING', 'Applying AnalyserNode timing fix');
    
    if (!window.AudioContext) {
      debugLog('API_PATCHING', 'Web Audio API not available, cannot apply fix');
      return;
    }
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      
      if (!audioContext.createAnalyser) {
        debugLog('API_PATCHING', 'createAnalyser method not available');
        return;
      }
      
      // Original prototype to reference in case we need to revert
      const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
      this.originalMethods.createAnalyser = originalCreateAnalyser;
      
      // Patch the createAnalyser method
      AudioContext.prototype.createAnalyser = function() {
        debugLog('API_PATCHING', 'Intercepted createAnalyser call');
        
        const originalAnalyser = originalCreateAnalyser.call(this);
        
        // Set optimized defaults for Edge
        originalAnalyser.fftSize = 32; // Use smaller FFT size by default (can be changed later)
        originalAnalyser.smoothingTimeConstant = 0.7;
        
        // Store original getByteTimeDomainData method
        const originalGetByteTimeDomainData = originalAnalyser.getByteTimeDomainData;
        
        // Add additional performance monitoring
        originalAnalyser.getByteTimeDomainData = function(dataArray) {
          const startTime = performance.now();
          
          // Call original method
          originalGetByteTimeDomainData.call(this, dataArray);
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // Log slow operations
          if (DEBUG.VERBOSE && duration > 5) {
            debugLog('API_PATCHING', `getByteTimeDomainData took ${duration.toFixed(2)}ms`);
          }
          
          // If consistently very slow, emit a warning
          if (duration > 20) {
            eventBus.emit('audio-performance-warning', {
              operation: 'getByteTimeDomainData',
              duration: duration,
              threshold: 20
            });
          }
        };
        
        debugLog('API_PATCHING', 'AnalyserNode methods patched with Edge-specific optimizations');
        return originalAnalyser;
      };
      
      // Clean up context used for patching
      audioContext.close();
      
      debugLog('API_PATCHING', 'AnalyserNode timing fix successfully applied');
    } catch (err) {
      debugLog('API_PATCHING', 'Error applying AnalyserNode fix:', err);
      console.error('Failed to apply Edge analyzer fix:', err);
      
      // Notify application that the fix failed
      eventBus.emit('edge-fix-failed', {
        fix: 'analyzer',
        error: err
      });
    }
  }
  
  /**
   * Set up monitoring for audio processing performance
   */
  setupPerformanceMonitoring() {
    debugLog('API_PATCHING', 'Setting up audio performance monitoring');
    
    // Track performance of audio operations
    const performanceData = {
      samples: [],
      maxSampleTime: 0,
      warnings: 0
    };
    
    // Listen for performance warning events
    eventBus.on('audio-performance-warning', (data) => {
      performanceData.warnings++;
      performanceData.samples.push(data.duration);
      
      if (data.duration > performanceData.maxSampleTime) {
        performanceData.maxSampleTime = data.duration;
      }
      
      if (performanceData.warnings % 10 === 0) {
        debugLog('API_PATCHING', `Audio performance issues detected: ${performanceData.warnings} warnings`, {
          average: performanceData.samples.reduce((a, b) => a + b, 0) / performanceData.samples.length,
          max: performanceData.maxSampleTime,
          recent: data.duration
        });
      }
    });
    
    debugLog('API_PATCHING', 'Performance monitoring setup complete');
  }
  
  /**
   * Remove applied fixes and restore original behavior
   */
  removeFixes() {
    if (!this.fixesApplied) {
      debugLog('API_PATCHING', 'No fixes to remove');
      return;
    }
    
    debugLog('API_PATCHING', 'Removing Edge-specific fixes...');
    
    try {
      // Restore original methods if we have them
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        
        if (this.originalMethods.createMediaStreamSource) {
          AudioContext.prototype.createMediaStreamSource = this.originalMethods.createMediaStreamSource;
          debugLog('API_PATCHING', 'Restored original createMediaStreamSource method');
        }
        
        if (this.originalMethods.createAnalyser) {
          AudioContext.prototype.createAnalyser = this.originalMethods.createAnalyser;
          debugLog('API_PATCHING', 'Restored original createAnalyser method');
        }
      }
      
      this.fixesApplied = false;
      debugLog('API_PATCHING', 'All Edge-specific fixes removed');
      
      eventBus.emit('edge-fixes-removed');
    } catch (err) {
      debugLog('API_PATCHING', 'Error removing fixes:', err);
      console.error('Failed to remove Edge fixes:', err);
    }
  }
}

// Create and export a singleton instance
export const edgeAudioFix = new EdgeAudioFix();