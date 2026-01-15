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
      this.deviceListContainer.innerHTML = '<div class="alert alert-info text-center">暂无设备。等待设备注册...</div>';
      return;
    }

    // Create table header
    const tableHeader = document.createElement('div');
    tableHeader.className = 'device-table-header row g-3 mb-3 fw-bold';
    tableHeader.innerHTML = `
      <div class="col-md-3">设备名称</div>
      <div class="col-md-3">UUID</div>
      <div class="col-md-2">在线状态</div>
      <div class="col-md-2">最后在线时间</div>
      <div class="col-md-2">操作</div>
    `;
    this.deviceListContainer.appendChild(tableHeader);

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
    deviceDiv.className = 'device-row row g-3 py-2 border-bottom align-items-center';
    deviceDiv.id = `device-${device.id}`;

    // Determine status class and text
    const statusClass = device.isOnline() ? 'status-badge online' : 'status-badge offline';
    const statusText = device.isOnline() ? '在线' : '离线';

    // Format last seen time
    const lastSeenTime = device.lastSeen ? new Date(device.lastSeen).toLocaleString('zh-CN') : '未知';

    deviceDiv.innerHTML = `
      <div class="col-md-3">${device.name}</div>
      <div class="col-md-3">${device.id}</div>
      <div class="col-md-2"><span class="${statusClass}">${statusText}</span></div>
      <div class="col-md-2">${lastSeenTime}</div>
      <div class="col-md-2">
        <button class="btn btn-primary btn-sm view-device-btn" data-device-id="${device.id}">
          <i class="fas fa-eye me-1"></i> 查看
        </button>
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
    const statusElement = deviceElement.querySelector('.status-badge');
    if (statusElement) {
      statusElement.textContent = status === 'online' ? '在线' : '离线';
      statusElement.className = status === 'online' ? 'status-badge online' : 'status-badge offline';
    }
  }

  /**
   * Binds event listeners for control buttons.
   */
  bindControlEvents() {
    // Use event delegation for device controls
    this.deviceListContainer.addEventListener('click', (event) => {
      const target = event.target;

      // Handle view button - navigate to device detail page
      if (target.classList.contains('view-device-btn') || target.closest('.view-device-btn')) {
        const btn = target.classList.contains('view-device-btn') ? target : target.closest('.view-device-btn');
        const deviceId = btn.getAttribute('data-device-id');
        this.showDeviceDetails(deviceId);
      }
    });

    // Handle device detail page controls
    document.addEventListener('click', (event) => {
      const target = event.target;

      // Back to devices button
      if (target.id === 'back-to-devices') {
        this.showDeviceList();
      }
      // Start video button on device detail page
      else if (target.id === 'start-video-btn') {
        const deviceId = document.getElementById('current-device-id')?.textContent;
        if (deviceId) this.startVideoPreview(deviceId);
      }
      // Stop video button on device detail page
      else if (target.id === 'stop-video-btn') {
        const deviceId = document.getElementById('current-device-id')?.textContent;
        if (deviceId) this.stopVideoCommunication(deviceId);
      }
      // Start talk button on device detail page
      else if (target.id === 'start-talk-btn') {
        const deviceId = document.getElementById('current-device-id')?.textContent;
        if (deviceId) this.startVoiceTalk(deviceId);
      }
      // Stop talk button on device detail page
      else if (target.id === 'stop-talk-btn') {
        const deviceId = document.getElementById('current-device-id')?.textContent;
        if (deviceId) this.stopAudioCommunication(deviceId);
      }
      // Save device mode button on device detail page
      else if (target.id === 'save-device-mode') {
        const deviceId = document.getElementById('current-device-id')?.textContent;
        const mode = document.getElementById('device-mode-select')?.value;
        if (deviceId && mode) this.sendControlCommand(deviceId, `set_mode:${mode}`);
      }
      // PTZ and movement buttons
      else if (target.classList.contains('ptz-btn') || target.classList.contains('movement-btn') || target.classList.contains('action-btn')) {
        const deviceId = document.getElementById('current-device-id')?.textContent;
        const command = target.getAttribute('data-command');
        if (deviceId && command) this.sendControlCommand(deviceId, command);
      }
    });
  }

  /**
   * Shows device detail page for a specific device.
   * @param {string} deviceId The ID of the device to show.
   */
  showDeviceDetails(deviceId) {
    // Hide all content views
    document.querySelectorAll('.content-view').forEach(view => {
      view.classList.remove('active');
    });

    // Show device detail view
    const deviceDetailView = document.getElementById('device-detail');
    if (deviceDetailView) {
      deviceDetailView.classList.add('active');

      // Set the current device ID
      let deviceIdEl = document.getElementById('current-device-id');
      if (!deviceIdEl) {
        deviceIdEl = document.createElement('div');
        deviceIdEl.id = 'current-device-id';
        deviceIdEl.style.display = 'none';
        document.body.appendChild(deviceIdEl);
      }
      deviceIdEl.textContent = deviceId;

      // Update device detail header
      const devices = this.mqttClient.getDeviceList();
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        const headerEl = document.getElementById('device-detail-header');
        if (headerEl) {
          headerEl.innerHTML = `
            <h3>${device.name}</h3>
            <p class="text-muted mb-0">ID: ${device.id} | 状态: <span class="${device.isOnline() ? 'status-badge online' : 'status-badge offline'}">${device.isOnline() ? '在线' : '离线'}</span></p>
          `;
        }
      }
    }
  }

  /**
   * Shows the device list view.
   */
  showDeviceList() {
    // Hide all content views
    document.querySelectorAll('.content-view').forEach(view => {
      view.classList.remove('active');
    });

    // Show device management view
    const deviceManagementView = document.getElementById('device-management');
    if (deviceManagementView) {
      deviceManagementView.classList.add('active');
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
    } else {
      // Remove any existing preview content and create new video element
      this.videoPreviewContainer.innerHTML = '';
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
    const audioElement = document.getElementById('audio-preview');
    if (audioElement) {
      audioElement.srcObject = stream;
      audioElement.style.display = 'block';
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

    // Hide audio element if it exists
    const audioElement = document.getElementById('audio-preview');
    if (audioElement) {
      audioElement.style.display = 'none';
      audioElement.srcObject = null;
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
