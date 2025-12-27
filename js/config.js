/**
 * @fileoverview Configuration module for the device management system.
 * Contains all configuration settings shared across modules.
 */

/**
 * Configuration class that holds all system configuration settings.
 */
class Config {
  /**
   * Creates a new Config instance with default values.
   */
  constructor() {
    // Default MQTT broker URL
    this.mqttBrokerUrl = 'wss://lab10000.ala.asia-southeast1.emqxsl.com:8084/mqtt';
    
    // Default registration topic pattern for discovering devices
    this.registrationTopicPattern = 'device/+/register';
    
    // Default prefix for device control topics
    this.deviceControlTopicPrefix = 'device/control/';
    
    // Default WebRTC configuration
    this.webrtcConfig = {
      iceServers: [
            {
              urls: 'turn:relay1.expressturn.com:3480', username: '000000002071711344', credential: 'JW+ECRKpe+faXK5gAhiy0uz8B3A=' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      sdpSemantics: 'unified-plan'
    };
    
    // Default topic for device status updates
    this.deviceStatusTopicPattern = 'devices/+/status';
    
    // Default topic for WebRTC signaling
    this.webrtcSignalTopicPrefix = 'response';
    
    // Default timeout for device registration
    this.deviceRegistrationTimeout = 30000; // 30 seconds
    
    // Default interval for device heartbeat
    this.heartbeatInterval = 10000; // 10 seconds
  }

  /**
   * Gets the MQTT configuration settings.
   * @return {Object} The MQTT configuration object containing broker URL and topic patterns.
   */
  getMQTTConfig() {
    return {
      brokerUrl: this.mqttBrokerUrl,
      registrationTopicPattern: this.registrationTopicPattern,
      deviceControlTopicPrefix: this.deviceControlTopicPrefix,
      deviceStatusTopicPattern: this.deviceStatusTopicPattern,
      deviceRegistrationTimeout: this.deviceRegistrationTimeout,
      heartbeatInterval: this.heartbeatInterval,
      webrtcSignalTopicPrefix: this.webrtcSignalTopicPrefix
    };
  }

  /**
   * Gets the WebRTC configuration settings.
   * @return {Object} The WebRTC configuration object.
   */
  getWebRTCConfig() {
    return {
      iceServers: this.webrtcConfig.iceServers,
      sdpSemantics: this.webrtcConfig.sdpSemantics
    };
  }

  /**
   * Updates the MQTT broker URL.
   * @param {string} url The new MQTT broker URL.
   */
  setMqttBrokerUrl(url) {
    if (typeof url === 'string' && url.length > 0) {
      this.mqttBrokerUrl = url;
    } else {
      console.warn('Invalid MQTT broker URL provided, using default value.');
    }
  }

  /**
   * Updates the registration topic pattern.
   * @param {string} pattern The new registration topic pattern.
   */
  setRegistrationTopicPattern(pattern) {
    if (typeof pattern === 'string' && pattern.length > 0) {
      this.registrationTopicPattern = pattern;
    } else {
      console.warn('Invalid registration topic pattern provided, using default value.');
    }
  }

  /**
   * Updates the device control topic prefix.
   * @param {string} prefix The new device control topic prefix.
   */
  setDeviceControlTopicPrefix(prefix) {
    if (typeof prefix === 'string' && prefix.length > 0) {
      this.deviceControlTopicPrefix = prefix;
    } else {
      console.warn('Invalid device control topic prefix provided, using default value.');
    }
  }

  /**
   * Updates the WebRTC configuration.
   * @param {Object} config The new WebRTC configuration object.
   */
  setWebRTCConfig(config) {
    if (config && typeof config === 'object') {
      this.webrtcConfig = {
        iceServers: config.iceServers || this.webrtcConfig.iceServers,
        sdpSemantics: config.sdpSemantics || this.webrtcConfig.sdpSemantics
      };
    } else {
      console.warn('Invalid WebRTC configuration provided, using default value.');
    }
  }
}

// Export the Config class for use in other modules
// In a browser environment, we'll attach it to the window object
// In a Node.js environment, we would use module.exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
} else {
  window.Config = Config;
}
