class Device {
    /**
     * Creates a new Device instance.
     * @param {string} id The device ID.
     * @param {string} name The device name.
     * @param {Object} registrationData The registration data.
     */
    constructor(id, name, registrationData) {
        this.id = id;
        this.name = name;
        this.status = registrationData.status || 'online';
        this.registrationTopic = registrationData.registrationTopic || `device/${id}/register`;
        this.controlTopic = registrationData.controlTopic || `device/control/${id}`;
        this.lastSeen = Date.now();
    }

    /**
     * Updates the device status.
     * @param {string} status The new status.
     */
    updateStatus(status) {
        this.status = status;
        this.lastSeen = Date.now();
    }

    /**
     * Checks if the device is online.
     * @return {boolean} True if the device is online.
     */
    isOnline() {
        // Consider device offline if not seen for more than 2x heartbeat interval
        const config = new Config();
        const maxInactivity = config.getMQTTConfig().heartbeatInterval * 2;
        return (Date.now() - this.lastSeen) < maxInactivity;
    }
}
