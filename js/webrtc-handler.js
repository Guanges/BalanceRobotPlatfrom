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
    this.peerConnectionVideo = null;
    this.peerConnectionTalk = null;
    this.localStreamTalk = null;
    this.remoteStreamTalk = null;
    this.remoteStreamVideo = null;
    this.currentDeviceId = null;
    this.isVideoActive = false;
    this.isVoiceActive = false;
    this.onRemoteStreamVideoReceived = null; // Callback for when remote stream is available
    this.onRemoteStreamAudioReceived = null; // Callback for when remote stream is available
    this.onConnectionStateChange = null; // Callback for connection state changes

    // Bind event handlers
    this.handleWebRTCSignalTalk = this.handleWebRTCSignalTalk.bind(this);
    this.handleWebRTCSignalVideo = this.handleWebRTCSignalVideo.bind(this);
    
    // Set up MQTT client callback for WebRTC signaling
    this.mqttClient.onWebRTCSignalAudio = this.handleWebRTCSignalTalk;
    this.mqttClient.onWebRTCSignalVideo = this.handleWebRTCSignalVideo;
    this.uuid = this.generateUUID();
  }

    generateUUID() {
        // Generate a simple UUID for identifying the client
        return Math.random().toString(16).slice(2);
    }
  /**
   * Initializes a WebRTC connection with a device.
   * @param {string} deviceId The ID of the device to connect to.
   */
  initializeVideoConnection(deviceId) {
    this.currentDeviceId = deviceId;
    
    // Create new peer connection
      this.peerConnectionVideo = new RTCPeerConnection(this.config);
      console.log(
          'ICE servers actually used:',
          this.peerConnectionVideo.getConfiguration().iceServers
      );
      this.peerConnectionVideo.ontrack = (event) => {
        // Handle remote stream
      console.log('Track kind:', event.track.kind); // 应该是 'video'
      this.remoteStreamVideo = event.streams[0];
      if (this.onRemoteStreamVideoReceived) {
        this.onRemoteStreamReceived(this.remoteStreamVideo);
      }
    };
    
      this.peerConnectionVideo.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
          this.onConnectionStateChange(this.peerConnectionVideo.connectionState);
      }
          console.log('WebRTC connection state changed:', this.peerConnectionVideo.connectionState);
    };
    
      this.peerConnectionVideo.oniceconnectionstatechange = () => {
          console.log('WebRTC ICE connection state changed:', this.peerConnectionVideo.iceConnectionState);
    };
  }
  initializeAudioConnection(deviceId) {
        this.currentDeviceId = deviceId;

        // Create new peer connection
        this.peerConnectionTalk = new RTCPeerConnection(this.config);
        console.log(
            'ICE servers actually used:',
            this.peerConnectionTalk.getConfiguration().iceServers
        );
      this.peerConnectionTalk.ontrack = (event) => {
            // Handle remote stream
            console.log('Track kind:', event.track.kind); // 应该是 'video'
            this.remoteStreamTalk = event.streams[0];
            if (this.onRemoteStreamAudioReceived) {
                this.onRemoteStreamReceived(this.remoteStreamTalk);
            }
        };

      this.peerConnectionTalk.onconnectionstatechange = () => {
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.peerConnectionTalk.connectionState);
            }
          console.log('WebRTC connection state changed:', this.peerConnectionTalk.connectionState);
        };

      this.peerConnectionTalk.oniceconnectionstatechange = () => {
            console.log('WebRTC ICE connection state changed:', this.peerConnectionTalk.iceConnectionState);
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
    async handleOfferVideo(deviceId, offer) {
        try {
            if (!this.peerConnectionVideo) {
                this.initializeVideoConnection(deviceId);
            }

            // ⭐ 1️⃣ 先 setRemoteDescription（非常关键）
            await this.peerConnectionVideo.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            // ⭐ 3️⃣ 创建 answer
            const answer = await this.peerConnectionVideo.createAnswer();

            // ⭐ 4️⃣ setLocalDescription
            await this.peerConnectionVideo.setLocalDescription(answer);

            // ⭐ 5️⃣ 等 ICE gathering 完成
            await this.waitForIceGatheringComplete(this.peerConnectionVideo);

            const fullAnswer = this.peerConnectionVideo.localDescription;

            console.log('Answer SDP:', fullAnswer.sdp); // 🔍 必须看到 a=candidate

            // ⭐ 6️⃣ 发送完整 SDP
            this.mqttClient.sendWebRTCSignalWithResponseTopic(
                deviceId,
                {
                    type: 'answer',
                    userid: this.uuid,
                    sdp: fullAnswer.sdp
                },
                `response/video/${deviceId}`
            );
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
        }
    }

    async handleOfferAudio(deviceId, offer) {
        try {
            if (!this.peerConnectionTalk) {
                this.initializeAudioConnection(deviceId);
            }

            // ⭐ 1️⃣ 先 setRemoteDescription（非常关键）
            await this.peerConnectionTalk.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            // ⭐ 2️⃣ 再获取并添加本地音频
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.localStream.getTracks().forEach(track => {
                this.peerConnectionTalk.addTrack(track, this.localStream);
            });

            // ⭐ 3️⃣ 创建 answer
            const answer = await this.peerConnectionTalk.createAnswer();

            // ⭐ 4️⃣ setLocalDescription
            await this.peerConnectionTalk.setLocalDescription(answer);

            // ⭐ 5️⃣ 等 ICE gathering 完成
            await this.waitForIceGatheringComplete(this.peerConnectionTalk);

            const fullAnswer = this.peerConnectionTalk.localDescription;

            console.log('Answer SDP:', fullAnswer.sdp); // 🔍 必须看到 a=candidate

            // ⭐ 6️⃣ 发送完整 SDP
            this.mqttClient.sendWebRTCSignalWithResponseTopic(
                deviceId,
                {
                    type: 'answer',
                    userid: this.uuid,
                    sdp: fullAnswer.sdp
                },
                `response/audio/${deviceId}`
            );
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
        }
    }

    async waitForIceGatheringComplete(pc, timeout = 3000) {
        if (pc.iceGatheringState === 'complete') return;

        await Promise.race([
            new Promise(resolve => {
                const check = () => {
                    if (pc.iceGatheringState === 'complete') {
                        pc.removeEventListener('icegatheringstatechange', check);
                        resolve();
                    }
                };
                pc.addEventListener('icegatheringstatechange', check);
            }),
            new Promise(resolve => setTimeout(resolve, timeout))
        ]);
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
            type: 'startvideo',
            userid: this.uuid
        }, "response/video/" + deviceId);
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
            userid: this.uuid
        }, "response/audio/" + deviceId);
      
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
    stopVideoCommunication(deviceId) {
        this.mqttClient.sendWebRTCSignalWithResponseTopic(deviceId, {
            type: 'stopvideo',
            userid: this.uuid
        }, "response/video/" + deviceId);
    // Close peer connection
    if (this.peerConnectionVideo) {
        this.peerConnectionVideo.close();
        this.peerConnectionVideo = null;
    }
    
    // Clear remote stream
    this.remoteStreamVideo = null;
  }

    stopAudioCommunication(deviceId) {
        this.mqttClient.sendWebRTCSignalWithResponseTopic(deviceId, {
            type: 'stoptalk',
            userid: this.uuid
        }, "response/audio/" + deviceId);
        // Close peer connection
        if (this.peerConnectionTalk) {
            this.peerConnectionTalk.close();
            this.peerConnectionTalk = null;
        }

        // Stop local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Clear remote stream
        this.remoteStreamAudio = null;

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
  async handleWebRTCSignalVideo(deviceId, signalData) {
    try {
      switch (signalData.type) {
        case 'offer':
          await this.handleOfferVideo(deviceId, signalData);
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

    async handleWebRTCSignalTalk(deviceId, signalData) {
        try {
            switch (signalData.type) {
                case 'offer':
                    await this.handleOfferAudio(deviceId, signalData);
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
