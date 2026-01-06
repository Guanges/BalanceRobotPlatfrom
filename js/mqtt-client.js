/**
 * @fileoverview MQTT client module for device discovery and control.
 * Handles MQTT communication for device registration and control commands.
 */

/**
 * MQTTClient class for handling MQTT communication with devices.
 */
class MQTTClient {
  /**
   * Creates a new MQTTClient instance.
   * @param {Config} config The configuration object.
   */
  constructor(config) {
    this.config = config;
    this.brokerUrl = config.getMQTTConfig().brokerUrl;
    this.client = null;
    this.deviceList = [];
    this.deviceMap = new Map(); // For quick device lookup by ID
    this.onDeviceListUpdate = null; // Callback for device list updates
    this.onDeviceStatusUpdate = null; // Callback for device status updates
    this.onWebRTCSignalAudio = null; // Callback for WebRTC signaling messages
    this.onWebRTCSignalVideo = null; // Callback for WebRTC signaling messages
  }

  /**
   * Connects to the MQTT broker.
   */
  connect() {
    // Import mqtt.js library
    if (typeof mqtt === 'undefined') {
      console.error('MQTT.js library not found. Please include mqtt.js in your project.');
      return;
    }

    const clientId = 'mqttjs_' + Math.random().toString(16).substring(2, 8)

    const options = {
        keepalive: 60,
        clientId: clientId,
        clean: true,
        connectTimeout: 30 * 1000,
        /**
        * By default, EMQX allows clients to connect without authentication.
        * https://docs.emqx.com/en/enterprise/v4.4/advanced/auth.html#anonymous-login
        */
        username: 'luka',
        password: 'luka@2025',
        reconnectPeriod: 1000,
        protocolVersion: 5,
        // for more options and details, please refer to https://github.com/mqttjs/MQTT.js#mqttclientstreambuilder-options
    }
    console.log('connecting mqtt client')
    // Create MQTT client
    this.client = mqtt.connect(this.brokerUrl, options);

    // Set up event handlers
    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      //this.subscribeToRegistrationTopic();
      this.subscribeToDeviceStatusTopic();
      //this.subscribeToWebRTCSignalTopic();
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error);
    });

    // https://github.com/mqttjs/MQTT.js#event-reconnect
    this.client.on('reconnect', () => {
        console.log('Reconnecting...')
    })

    this.client.on('message', (topic, message) => {
      this.onMessageReceived(topic, message);
    });
  }

  /**
   * Subscribes to the device registration topic.
   */
  subscribeToRegistrationTopic() {
    const registrationTopic = this.config.getMQTTConfig().registrationTopicPattern;
    this.client.subscribe(registrationTopic, (err) => {
      if (err) {
        console.error('Failed to subscribe to registration topic:', err);
      } else {
        console.log('Subscribed to registration topic:', registrationTopic);
      }
    });
  }

  /**
   * Subscribes to the device status topic.
   */
  subscribeToDeviceStatusTopic() {
    const statusTopic = this.config.getMQTTConfig().deviceStatusTopicPattern;
    this.client.subscribe(statusTopic, (err) => {
      if (err) {
        console.error('Failed to subscribe to status topic:', err);
      } else {
        console.log('Subscribed to status topic:', statusTopic);
      }
    });
  }

  /**
   * Subscribes to the WebRTC signaling topic.
   */
  subscribeToWebRTCSignalTopic() {
    const signalTopic = this.config.getMQTTConfig().webrtcSignalTopicPrefix + '+';
    this.client.subscribe(signalTopic, (err) => {
      if (err) {
        console.error('Failed to subscribe to WebRTC signal topic:', err);
      } else {
        console.log('Subscribed to WebRTC signal topic:', signalTopic);
      }
    });
  }

  /**
   * Handles incoming MQTT messages.
   * @param {string} topic The topic of the message.
   * @param {Buffer} message The message payload.
   */
  onMessageReceived(topic, message) {
    try {
      const messageStr = message.toString();
      console.log(`Received message on topic ${topic}: ${messageStr}`);

      // Check if this is a device registration message
      if (this.isRegistrationTopic(topic)) {
        this.handleDeviceRegistration(topic, messageStr);
      } 
      // Check if this is a device status message
      else if (this.isStatusTopic(topic)) {
        this.handleDeviceStatusUpdate(topic, messageStr);
      } 
      // Check if this is a WebRTC signaling message
      else if (this.isWebRTCSignalTopic(topic)) {
        this.handleWebRTCSignal(topic, messageStr);
      }
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  /**
   * Checks if the topic is a device registration topic.
   * @param {string} topic The topic to check.
   * @return {boolean} True if the topic matches the registration pattern.
   */
  isRegistrationTopic(topic) {
    const registrationPattern = this.config.getMQTTConfig().registrationTopicPattern;
    // Replace '+' with '[^/]*' to create a regex pattern
    const regexPattern = registrationPattern.replace(/\+/g, '[^/]*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  /**
   * Checks if the topic is a device status topic.
   * @param {string} topic The topic to check.
   * @return {boolean} True if the topic matches the status pattern.
   */
  isStatusTopic(topic) {
    const statusPattern = this.config.getMQTTConfig().deviceStatusTopicPattern;
    // Replace '+' with '[^/]*' to create a regex pattern
    const regexPattern = statusPattern.replace(/\+/g, '[^/]*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  /**
   * Checks if the topic is a WebRTC signaling topic.
   * @param {string} topic The topic to check.
   * @return {boolean} True if the topic matches the WebRTC signal pattern.
   */
  isWebRTCSignalTopic(topic) {
    const signalPrefix = this.config.getMQTTConfig().webrtcSignalTopicPrefix;
    return topic.startsWith(signalPrefix);
  }

  /**
   * Handles device registration messages.
   * @param {string} topic The registration topic.
   * @param {string} message The registration message.
   */
  handleDeviceRegistration(topic, message) {
    try {
      const registrationData = JSON.parse(message);
      
      // Extract device ID from topic
      const deviceId = topic.split('/')[1]; // Assuming format: device/{deviceId}/register
      
      // Check if device already exists
      if (this.deviceMap.has(deviceId)) {
        // Update existing device
        const existingDevice = this.deviceMap.get(deviceId);
        existingDevice.updateStatus(registrationData.status || 'online');
        existingDevice.isOnline = true;
      } else {
        // Create new device
        const device = new Device(deviceId, registrationData.name || `Device ${deviceId}`, registrationData);
        this.deviceList.push(device);
        this.deviceMap.set(deviceId, device);
      }
      
      // Notify listeners of device list update
      if (this.onDeviceListUpdate) {
        this.onDeviceListUpdate(this.deviceList);
      }
      
      console.log(`Device registered: ${deviceId}`, registrationData);
    } catch (error) {
      console.error('Error processing device registration:', error);
    }
  }

  /**
   * Handles device status update messages.
   * @param {string} topic The status topic.
   * @param {string} message The status message.
   */
  handleDeviceStatusUpdate(topic, message) {
    try {
      const statusData = JSON.parse(message);
      
      // Extract device ID from topic
      const deviceId = topic.split('/')[1]; // Assuming format: device/{deviceId}/status
        if (this.deviceMap.has(deviceId)) {
            // Update existing device
            const existingDevice = this.deviceMap.get(deviceId);
            existingDevice.updateStatus(statusData.status || 'online');
        } else {
            // Create new device
            const device = new Device(deviceId, statusData.name || `Device ${deviceId}`, statusData);
            this.deviceList.push(device);
            this.deviceMap.set(deviceId, device);
            // Notify listeners of device list update
            if (this.onDeviceListUpdate) {
                this.onDeviceListUpdate(this.deviceList);
            }
        }
        // Notify listeners of device status update
        if (this.onDeviceStatusUpdate) {
            this.onDeviceStatusUpdate(deviceId, statusData.status);
        }
      console.log(`Device status updated: ${deviceId}`, statusData);
    } catch (error) {
      console.error('Error processing device status update:', error);
    }
  }

  /**
   * Handles WebRTC signaling messages.
   * @param {string} topic The signaling topic.
   * @param {string} message The signaling message.
   */
  handleWebRTCSignal(topic, message) {
      try {
          const signalData = JSON.parse(message);

          // Extract device ID from topic
          const topicParts = topic.split('/');
          const type = topicParts[1];
          const deviceId = topicParts[2]; // Assuming format: response/{type}/{deviceId}

          // Notify listeners of WebRTC signal
          if (type == "audio") {
              if (this.onWebRTCSignalAudio) {
                  this.onWebRTCSignalAudio(deviceId, signalData);
              }
          }
          else {
              if (this.onWebRTCSignalVideo) {
                  this.onWebRTCSignalVideo(deviceId, signalData);
              }
          }
      console.log(`WebRTC signal received for device: ${deviceId}`, signalData);
    } catch (error) {
      console.error('Error processing WebRTC signal:', error);
    }
  }

  /**
   * Sends a control command to a specific device.
   * @param {string} deviceId The ID of the device to control.
   * @param {string} command The command to send.
   */
  sendControlCommand(deviceId, command) {
    if (!this.client || !this.client.connected) {
      console.error('MQTT client not connected');
      return;
    }

    const controlTopic = this.config.getMQTTConfig().deviceControlTopicPrefix + deviceId;
    const commandMessage = JSON.stringify({
      command: command,
      timestamp: Date.now()
    });

    this.client.publish(controlTopic, commandMessage, (err) => {
      if (err) {
        console.error('Failed to send control command:', err);
      } else {
        console.log(`Control command sent to ${deviceId}: ${command}`);
      }
    });
  }

  /**
   * Gets the current list of devices.
   * @return {Array<Device>} The list of registered devices.
   */
  getDeviceList() {
    return this.deviceList;
  }

  /**
   * Sends a WebRTC signaling message to a specific device.
   * @param {string} deviceId The ID of the device.
   * @param {Object} signalData The signaling data to send.
   */
    sendWebRTCSignal(deviceId, signalData) {
        if (!this.client || !this.client.connected) {
            console.error('MQTT client not connected');
            return;
        }
        const signalTopic = deviceId;
        const signalMessage = JSON.stringify(signalData);

        this.client.publish(signalTopic, signalMessage, (err) => {
            if (err) {
                console.error('Failed to send WebRTC signal:', err);
            } else {
                console.log(`WebRTC signal sent to ${deviceId}:`, signalData);
            }
        });
    }

    sendWebRTCSignalWithResponseTopic(deviceId, signalData, responseTopic) {
        if (!this.client || !this.client.connected) {
            console.error('MQTT client not connected');
            return;
        }
        const requestId = crypto.randomUUID()
        const signalTopic = deviceId;
        const signalMessage = JSON.stringify(signalData);

        this.client.publish(signalTopic, signalMessage, {
            properties: {
                responseTopic: responseTopic,
                correlationData: requestId
            }
        })
        console.log(`WebRTC signal sent to ${deviceId} response topic ${responseTopic} :`, signalData);
        this.client.subscribe(responseTopic)
    }

}
