/**
 * @fileoverview Main application entry point for the device management system.
 * Initializes all components and handles the application startup sequence.
 */

// Wait for DOM to be fully loaded before initializing the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the configuration
  const config = new Config();

  // Initialize MQTT client with configuration
  const mqttClient = new MQTTClient(config);

  // Initialize WebRTC manager with MQTT client and WebRTC config
  const webRTCManager = new WebRTCManager(mqttClient, config.getWebRTCConfig());

  // Initialize UI manager with MQTT client and WebRTC manager
  const uiManager = new UIManager(mqttClient, webRTCManager);

  // Connect to MQTT broker
  mqttClient.connect();

  // Initialize the UI
  uiManager.init();

  // Store references in global scope for debugging purposes
  window.app = {
    config,
    mqttClient,
    webRTCManager,
    uiManager
  };

  console.log('Device management system initialized successfully');
});
