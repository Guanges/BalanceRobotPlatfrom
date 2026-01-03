/**
 * @fileoverview UI manager module for the device management system.
 * Handles the rendering and interaction of the user interface.
 */

/**
 * UIManager class for managing the user interface.
 */
class UIManager {
  /**
   * Creates a new UIManager instance.
   * @param {MQTTClient} mqttClient The MQTT client instance.
   * @param {WebRTCManager} webRTCManager The WebRTC manager instance.
   */
  constructor(mqttClient, webRTCManager) {
    this.mqttClient = mqttClient;
    this.webRTCManager = webRTCManager;
    this.deviceListContainer = null;
    this.videoPreviewContainer = null;
    this.currentVideoElement = null;
    
    // Bind event handlers
    this.handleDeviceListUpdate = this.handleDeviceListUpdate.bind(this);
    this.handleDeviceStatusUpdate = this.handleDeviceStatusUpdate.bind(this);
    this.handleRemoteStreamReceived = this.handleRemoteStreamReceived.bind(this);
    
    // Set up callbacks
    this.mqttClient.onDeviceListUpdate = this.handleDeviceListUpdate;
    this.mqttClient.onDeviceStatusUpdate = this.handleDeviceStatusUpdate;
    this.webRTCManager.onRemoteStreamReceived = this.handleRemoteStreamReceived;
  }

  /**
   * Initializes the UI manager by setting up DOM elements and event listeners.
   */
  init() {
    // Get DOM elements
    this.deviceListContainer = document.getElementById('device-list');
    this.videoPreviewContainer = document.getElementById('video-preview-container');
    
    // Bind control events
    this.bindControlEvents();
    
    // Initial render
    this.renderDeviceList(this.mqttClient.getDeviceList());
  }

  /**
   * Renders the list of devices in the UI.
   * @param {Array<Device>} devices The list of devices to render.
   */
  renderDeviceList(devices) {
    if (!this.deviceListContainer) {
      console.error('Device list container not found');
      return;
    }
    
    // Clear existing content
    this.deviceListContainer.innerHTML = '';
    
    if (devices.length === 0) {
      this.deviceListContainer.innerHTML = '<div class="alert alert-info">No devices found. Waiting for device registration...</div>';
      return;
    }
    
    // Create device list items
    devices.forEach(device => {
      const deviceElement = this.createDeviceElement(device);
      this.deviceListContainer.appendChild(deviceElement);
    });
  }

  /**
   * Creates a DOM element for a single device.
   * @param {Device} device The device to create an element for.
   * @return {HTMLElement} The created device element.
   */
  createDeviceElement(device) {
    const deviceDiv = document.createElement('div');
    deviceDiv.className = 'device-item card mb-3';
    deviceDiv.id = `device-${device.id}`;
    
    // Determine status class
    const statusClass = device.isOnline() ? 'status-online' : 'status-offline';
    const statusText = device.isOnline() ? 'Online' : 'Offline';
    
    deviceDiv.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">${device.name} <span class="badge ${statusClass}">${statusText}</span></h5>
        <p class="card-text">ID: ${device.id}</p>
        <div class="device-controls">
          <button class="btn btn-primary btn-sm start-video-btn" data-device-id="${device.id}">Start Video Preview</button>
          <button class="btn btn-success btn-sm start-talk-btn" data-device-id="${device.id}">Start Voice Talk</button>
          <button class="btn btn-warning btn-sm stop-btn" data-device-id="${device.id}">Stop</button>
          <div class="device-actions mt-2">
            <button class="btn btn-secondary btn-sm action-btn" data-device-id="${device.id}" data-command="light_on">Light On</button>
            <button class="btn btn-secondary btn-sm action-btn" data-device-id="${device.id}" data-command="light_off">Light Off</button>
            <button class="btn btn-secondary btn-sm action-btn" data-device-id="${device.id}" data-command="lock">Lock</button>
            <button class="btn btn-secondary btn-sm action-btn" data-device-id="${device.id}" data-command="unlock">Unlock</button>
          </div>
        </div>
      </div>
    `;
    
    return deviceDiv;
  }

  /**
   * Updates the status of a specific device in the UI.
   * @param {string} deviceId The ID of the device to update.
   * @param {string} status The new status of the device.
   */
  updateDeviceStatus(deviceId, status) {
    const deviceElement = document.getElementById(`device-${deviceId}`);
    if (!deviceElement) {
      return;
    }
    
    // Update status badge
    const statusBadge = deviceElement.querySelector('.badge');
    if (statusBadge) {
      statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusBadge.className = status === 'online' ? 'badge status-online' : 'badge status-offline';
    }
  }

  /**
   * Binds event listeners for control buttons.
   */
  bindControlEvents() {
    // Use event delegation for device controls
    this.deviceListContainer.addEventListener('click', (event) => {
      const target = event.target;
      
      // Handle start video button
      if (target.classList.contains('start-video-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.startVideoPreview(deviceId);
      }
      // Handle start talk button
      else if (target.classList.contains('start-talk-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.startVoiceTalk(deviceId);
      }
      // Handle stop button
      else if (target.classList.contains('stop-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.stopCommunication(deviceId);
      }
      // Handle action buttons
      else if (target.classList.contains('action-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        const command = target.getAttribute('data-command');
        this.sendControlCommand(deviceId, command);
      }
    });
  }

  /**
   * Shows video preview in the UI.
   * @param {MediaStream} stream The video stream to display.
   */
  showVideoPreview(stream) {
    if (!this.videoPreviewContainer) {
      console.error('Video preview container not found');
      return;
    }
    
    // Remove existing video element if present
      if (this.currentVideoElement) {
          this.currentVideoElement.srcObject = stream;
      }
      else {
          // Create new video element
          const videoElement = document.createElement('video');
          videoElement.id = 'video-preview';
          videoElement.className = 'video-preview-element';
          videoElement.autoplay = true;
          videoElement.controls = true;
          videoElement.muted = true;
          videoElement.setAttribute('playsinline', '');
          videoElement.playsInline = true;
          // Set the stream as the video source
          videoElement.srcObject = stream;

          // Add to container
          this.videoPreviewContainer.appendChild(videoElement);
          this.currentVideoElement = videoElement;
      }
  }

  /**
   * Updates the UI based on current state.
   */
  updateUI() {
    // Update device list
    this.renderDeviceList(this.mqttClient.getDeviceList());
  }

  /**
   * Handles device list update events from MQTT client.
   * @param {Array<Device>} devices The updated list of devices.
   */
  handleDeviceListUpdate(devices) {
    this.renderDeviceList(devices);
  }

  /**
   * Handles device status update events from MQTT client.
   * @param {string} deviceId The ID of the device whose status changed.
   * @param {string} status The new status of the device.
   */
  handleDeviceStatusUpdate(deviceId, status) {
    this.updateDeviceStatus(deviceId, status);
  }

  /**
   * Handles remote stream received events from WebRTC manager.
   * @param {MediaStream} stream The received remote stream.
   */
  handleRemoteStreamReceived(stream) {
    this.showVideoPreview(stream);
  }

  /**
   * Starts video preview for a specific device.
   * @param {string} deviceId The ID of the device to start video preview for.
   */
  startVideoPreview(deviceId) {
    console.log(`Starting video preview for device: ${deviceId}`);
    this.webRTCManager.startVideoPreview(deviceId);
  }

  /**
   * Starts voice talk for a specific device.
   * @param {string} deviceId The ID of the device to start voice talk for.
   */
  startVoiceTalk(deviceId) {
    console.log(`Starting voice talk for device: ${deviceId}`);
    this.webRTCManager.startVoiceTalk(deviceId);
  }

  /**
   * Stops all communication with a specific device.
   * @param {string} deviceId The ID of the device to stop communication with.
   */
  stopCommunication(deviceId) {
    console.log(`Stopping communication with device: ${deviceId}`);
      this.webRTCManager.stopCommunication(deviceId);
    
    // Remove video preview if it exists
    if (this.currentVideoElement) {
      this.currentVideoElement.remove();
      this.currentVideoElement = null;
    }
  }

  /**
   * Sends a control command to a specific device.
   * @param {string} deviceId The ID of the device to send the command to.
   * @param {string} command The command to send.
   */
  sendControlCommand(deviceId, command) {
    console.log(`Sending command '${command}' to device: ${deviceId}`);
    this.mqttClient.sendControlCommand(deviceId, command);
  }
}
