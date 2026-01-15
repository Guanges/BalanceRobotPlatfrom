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
    this.currentAudioElement = null;
    
    // Bind event handlers
    this.handleDeviceListUpdate = this.handleDeviceListUpdate.bind(this);
    this.handleDeviceStatusUpdate = this.handleDeviceStatusUpdate.bind(this);
    this.handleRemoteStreamVideoReceived = this.handleRemoteStreamVideoReceived.bind(this);
    this.handleRemoteStreamAudioReceived = this.handleRemoteStreamAudioReceived.bind(this);
    // Set up callbacks
    this.mqttClient.onDeviceListUpdate = this.handleDeviceListUpdate;
    this.mqttClient.onDeviceStatusUpdate = this.handleDeviceStatusUpdate;
    this.webRTCManager.onRemoteStreamVideoReceived = this.handleRemoteStreamVideoReceived;
    this.webRTCManager.onRemoteStreamAudioReceived = this.handleRemoteStreamAudioReceived;
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
        <div class="d-flex justify-content-between align-items-start">
          <h5 class="card-title mb-0">${device.name} <span class="badge ${statusClass}">${statusText}</span></h5>
          <div><button class="btn btn-outline-primary btn-sm view-device-btn" data-device-id="${device.id}">查看</button></div>
        </div>
        <p class="card-text">ID: ${device.id}</p>
        <div class="device-controls">
          <button class="btn btn-primary btn-sm start-video-btn" data-device-id="${device.id}">Start Video Preview</button>
          <button class="btn btn-warning btn-sm stop-video-btn" data-device-id="${device.id}">Stop Video</button>
          <button class="btn btn-success btn-sm start-talk-btn" data-device-id="${device.id}">Start Voice Talk</button>
          <button class="btn btn-warning btn-sm stop-talk-btn" data-device-id="${device.id}">Stop Talk</button>
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

      // Handle view button
      if (target.classList.contains('view-device-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.showDeviceModal(deviceId);
      }
      // Handle start video button
      else if (target.classList.contains('start-video-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.startVideoPreview(deviceId);
      }
      // Handle start talk button
      else if (target.classList.contains('start-talk-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.startVoiceTalk(deviceId);
      }
      // Handle stop button
      else if (target.classList.contains('stop-video-btn')) {
        const deviceId = target.getAttribute('data-device-id');
        this.stopVideoCommunication(deviceId);
      }
      else if (target.classList.contains('stop-talk-btn')) {
          const deviceId = target.getAttribute('data-device-id');
          this.stopAudioCommunication(deviceId);
      }
      // Handle action buttons
      else if (target.classList.contains('action-btn')) {
        const deviceId = target.getAttribute('data-device-id') || document.getElementById('deviceDetailId')?.textContent;
        const command = target.getAttribute('data-command');
        if (deviceId) this.sendControlCommand(deviceId, command);
      }
    });

    // Modal controls (buttons inside modal may be outside device list)
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target.id === 'modal-start-video') {
        const deviceId = document.getElementById('deviceDetailId')?.textContent;
        if (deviceId) this.startVideoPreview(deviceId);
      }
      else if (target.id === 'modal-start-talk') {
        const deviceId = document.getElementById('deviceDetailId')?.textContent;
        if (deviceId) this.startVoiceTalk(deviceId);
      }
      else if (target.id === 'save-device-mode') {
        const deviceId = document.getElementById('deviceDetailId')?.textContent;
        const mode = document.getElementById('device-mode-select')?.value;
        if (deviceId && mode) this.sendControlCommand(deviceId, `set_mode:${mode}`);
      }
    });

    // Handle modal hidden to restore preview container
    const modalEl = document.getElementById('device-detail-modal');
    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', () => {
        // restore main preview container
        this.videoPreviewContainer = document.getElementById('video-preview-container');
        // clear modal video element
        const modalVideo = document.querySelector('#modal-video-preview video');
        if (modalVideo) modalVideo.remove();
        this.currentVideoElement = null;
      });
    }
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

    showAudioPlay(stream) {

        // Remove existing video element if present
        if (this.currentAudioElement) {
            this.currentAudioElement.srcObject = stream;
        }
        else {
            // Create new video element
            const audioElement = document.createElement('audio');
            audioElement.id = 'audio-preview';
            audioElement.className = 'audio-preview-element';
            audioElement.autoplay = true;
            audioElement.muted = false;
            audioElement.setAttribute('playsinline', '');
            audioElement.playsInline = true;
            // Set the stream as the video source
            audioElement.srcObject = stream;
            this.currentAudioElement = audioElement;
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
  handleRemoteStreamVideoReceived(stream) {
    this.showVideoPreview(stream);
  }

    handleRemoteStreamAudioReceived(stream) {
        this.showAudioPlay(stream);
    }

  /**
   * Shows device detail modal and prepares modal preview container.
   * @param {string} deviceId The ID of the device to show.
   */
  showDeviceModal(deviceId) {
    const titleEl = document.getElementById('deviceDetailTitle');
    const idEl = document.getElementById('deviceDetailId');
    if (titleEl) titleEl.textContent = deviceId;
    if (idEl) idEl.textContent = deviceId;
    // point preview to modal container
    const modalVideoContainer = document.getElementById('modal-video-preview');
    if (modalVideoContainer) this.videoPreviewContainer = modalVideoContainer;
    const modalEl = document.getElementById('device-detail-modal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
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
  stopVideoCommunication(deviceId) {
    console.log(`Stopping communication with device: ${deviceId}`);
      this.webRTCManager.stopVideoCommunication(deviceId);
    
    // Remove video preview if it exists
    if (this.currentVideoElement) {
      this.currentVideoElement.remove();
      this.currentVideoElement = null;
    }
  }

    stopAudioCommunication(deviceId) {
        console.log(`Stopping communication with device: ${deviceId}`);
        this.webRTCManager.stopAudioCommunication(deviceId);

        // Remove video preview if it exists
        if (this.currentAudioElement) {
            this.currentAudioElement.remove();
            this.currentAudioElement = null;
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
