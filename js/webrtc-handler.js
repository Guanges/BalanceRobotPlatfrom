/**
 * @fileoverview WebRTC handler module for video preview and voice intercom functionality.
 * Handles WebRTC connections for video streaming and voice communication with devices.
 */

/**
 * WebRTCManager class for managing WebRTC connections with devices.
 */
class WebRTCManager {
  /**
   * Creates a new WebRTCManager instance.
   * @param {MQTTClient} mqttClient The MQTT client for signaling.
   * @param {Object} config The WebRTC configuration.
   */
  constructor(mqttClient, config) {
    this.mqttClient = mqttClient;
    this.config = config;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentDeviceId = null;
    this.isVideoActive = false;
    this.isVoiceActive = false;
    this.onRemoteStreamReceived = null; // Callback for when remote stream is available
    this.onConnectionStateChange = null; // Callback for connection state changes

    // Bind event handlers
    this.handleWebRTCSignal = this.handleWebRTCSignal.bind(this);
    
    // Set up MQTT client callback for WebRTC signaling
    this.mqttClient.onWebRTCSignal = this.handleWebRTCSignal;
  }

  /**
   * Initializes a WebRTC connection with a device.
   * @param {string} deviceId The ID of the device to connect to.
   */
  initializeConnection(deviceId) {
    this.currentDeviceId = deviceId;
    
    // Close any existing connection
    this.stopCommunication();
    
    // Create new peer connection
    this.peerConnection = new RTCPeerConnection(this.config);
      console.log(
          'ICE servers actually used:',
          this.peerConnection.getConfiguration().iceServers
      );
    this.peerConnection.ontrack = (event) => {
      // Handle remote stream
      this.remoteStream = event.streams[0];
      if (this.onRemoteStreamReceived) {
        this.onRemoteStreamReceived(this.remoteStream);
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
      console.log('WebRTC connection state changed:', this.peerConnection.connectionState);
    };
    
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('WebRTC ICE connection state changed:', this.peerConnection.iceConnectionState);
    };
  }

  /**
   * Creates an offer for the WebRTC connection.
   * @param {string} deviceId The ID of the device to connect to.
   */
  async createOffer(deviceId) {
    try {
      if (!this.peerConnection) {
        this.initializeConnection(deviceId);
      }
      
      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Set local description
      await this.peerConnection.setLocalDescription(offer);
      
      // Send offer to remote device via MQTT
      this.mqttClient.sendWebRTCSignal(deviceId, {
        type: 'offer',
        sdp: offer.sdp
      });
    } catch (error) {
      console.error('Error creating WebRTC offer:', error);
    }
  }

  /**
   * Handles an incoming offer from a device.
   * @param {string} deviceId The ID of the device sending the offer.
   * @param {Object} offer The offer object containing SDP.
   */
    async handleOffer(deviceId, offer) {
        try {
            if (!this.peerConnection) {
                this.initializeConnection(deviceId);
            }

            // ⭐ 1️⃣ 先 setRemoteDescription（非常关键）
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            // ⭐ 2️⃣ 再获取并添加本地音频
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // ⭐ 3️⃣ 创建 answer
            const answer = await this.peerConnection.createAnswer();

            // ⭐ 4️⃣ setLocalDescription
            await this.peerConnection.setLocalDescription(answer);

            // ⭐ 5️⃣ 等 ICE gathering 完成
            await this.waitForIceGatheringComplete(this.peerConnection);

            const fullAnswer = this.peerConnection.localDescription;

            console.log('Answer SDP:', fullAnswer.sdp); // 🔍 必须看到 a=candidate

            // ⭐ 6️⃣ 发送完整 SDP
            this.mqttClient.sendWebRTCSignalWithResponseTopic(
                deviceId,
                {
                    type: 'answer',
                    userid: '23435',
                    sdp: fullAnswer.sdp
                },
                `response/${deviceId}`
            );
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
        }
    }



async waitForIceGatheringComplete(pc) {
    if (pc.iceGatheringState === 'complete') return;

    await new Promise(resolve => {
        const check = () => {
            if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', check);
                resolve();
            }
        };
        pc.addEventListener('icegatheringstatechange', check);
    });
}

  /**
   * Creates an answer for the WebRTC connection.
   * @param {string} deviceId The ID of the device to connect to.
   */
  async createAnswer(deviceId) {
    try {
      if (!this.peerConnection) {
        this.initializeConnection(deviceId);
      }
      
      // Set local description
        await this.peerConnection.setLocalDescription(await this.peerConnection.createAnswer());

      await waitGatheringComplete();

        const answer = await this.peerConnection.localDescription;
        // Send answer to remote device via MQTT
        this.mqttClient.sendWebRTCSignalWithResponseTopic(deviceId, {
        type: 'answer',
            sdp: answer.sdp
        }, "response/" + deviceId);
    } catch (error) {
      console.error('Error creating WebRTC answer:', error);
    }
  }

  /**
   * Handles an incoming answer from a device.
   * @param {string} deviceId The ID of the device sending the answer.
   * @param {Object} answer The answer object containing SDP.
   */
  async handleAnswer(deviceId, answer) {
    try {
      if (!this.peerConnection) {
        this.initializeConnection(deviceId);
      }
      
      // Set remote description
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  }

  /**
   * Starts video preview for a device.
   * @param {string} deviceId The ID of the device to start video preview for.
   */
  async startVideoPreview(deviceId) {
    try {
      this.isVideoActive = true;
      
      // Send startvideo command to device via MQTT
        this.mqttClient.sendWebRTCSignalWithResponseTopic(deviceId, {
            type: 'starttalk',
            userid: '23435'
        }, "response/" + deviceId);
      // Create offer for video connection
      //await this.createOffer(deviceId);
    } catch (error) {
      console.error('Error starting video preview:', error);
      this.isVideoActive = false;
    }
  }

  /**
   * Starts voice intercom for a device.
   * @param {string} deviceId The ID of the device to start voice intercom for.
   */
  async startVoiceTalk(deviceId) {
    try {
      this.isVoiceActive = true;
      
      
      
      // Send starttalk command to device via MQTT
        this.mqttClient.sendWebRTCSignalWithResponseTopic(deviceId, {
            type: 'starttalk',
            userid: '23435'
        }, "response/" + deviceId);
      
      // Create offer for voice connection
      //await this.createOffer(deviceId);
    } catch (error) {
      console.error('Error starting voice talk:', error);
      this.isVoiceActive = false;
    }
  }

  /**
   * Stops all communication with the device.
   */
  stopCommunication() {
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Clear remote stream
    this.remoteStream = null;
    
    // Reset flags
    this.isVideoActive = false;
    this.isVoiceActive = false;
    this.currentDeviceId = null;
  }

  /**
   * Handles incoming WebRTC signaling messages from MQTT.
   * @param {string} deviceId The ID of the device sending the signal.
   * @param {Object} signalData The signaling data.
   */
  async handleWebRTCSignal(deviceId, signalData) {
    try {
      switch (signalData.type) {
        case 'offer':
          await this.handleOffer(deviceId, signalData);
          break;
        case 'answer':
          await this.handleAnswer(deviceId, signalData);
          break;
        case 'ice-candidate':
          if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
          break;
        default:
          console.warn('Unknown WebRTC signal type:', signalData.type);
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
    }
  }

  /**
   * Adds a local stream to the peer connection.
   * @param {MediaStream} stream The local stream to add.
   */
  async addLocalStream(stream) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    this.localStream = stream;
    
    // Add tracks to peer connection
    stream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, stream);
    });
  }

  /**
   * Gets the current remote stream.
   * @return {MediaStream} The remote stream if available.
   */
  getRemoteStream() {
    return this.remoteStream;
  }

  /**
   * Checks if video is currently active.
   * @return {boolean} True if video is active.
   */
  isVideoActive() {
    return this.isVideoActive;
  }

  /**
   * Checks if voice intercom is currently active.
   * @return {boolean} True if voice intercom is active.
   */
  isVoiceActive() {
    return this.isVoiceActive;
  }
}
