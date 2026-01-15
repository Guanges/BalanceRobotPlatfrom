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

  // Simple left nav behavior and notifications toggle
  document.addEventListener('click', (event) => {
    const t = event.target;
    if (t.id === 'toggle-notifications') {
      const sidebar = document.getElementById('notifications-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('hidden');
        t.textContent = sidebar.classList.contains('hidden') ? '展开' : '隐藏';
      }
    }
    // nav buttons
    if (t.classList && t.classList.contains('nav-btn')) {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      t.classList.add('active');
    }
  });

  // Store references in global scope for debugging purposes
  window.app = {
    config,
    mqttClient,
    webRTCManager,
    uiManager
  };

  console.log('Device management system initialized successfully');
});
