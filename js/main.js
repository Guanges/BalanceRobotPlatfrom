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

  // Navigation-content linkage functionality
  function showContentView(contentId) {
    // Hide all content views
    document.querySelectorAll('.content-view').forEach(view => {
      view.classList.remove('active');
    });

    // Show the requested content view
    const contentView = document.getElementById(contentId);
    if (contentView) {
      contentView.classList.add('active');
    }

    // Update active state of navigation buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.remove('active');
    });

    // Find the corresponding navigation button and activate it
    const navBtn = document.querySelector(`.nav-item[data-target="${contentId}"]`);
    if (navBtn) {
      navBtn.classList.add('active');
    }
  }

  // Handle navigation clicks
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', function() {
      const targetView = this.getAttribute('data-target');
      if (targetView) {
        showContentView(targetView);
      }
    });
  });


  // Store references in global scope for debugging purposes
  window.app = {
    config,
    mqttClient,
    webRTCManager,
    uiManager
  };

  console.log('Balance Robot Platform initialized successfully');
});
