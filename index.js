const { Accessory, Service, Characteristic } = require('homebridge');
const Gpio = require('onoff').Gpio;

class IntercomAccessory {
    constructor(log, config) {
        if (!config || !config.relayPin || !config.voltagePin) {
            throw new Error('Invalid configuration. Please provide relayPin and voltagePin.');
        }

        this.log = log;
        this.name = config.name || 'Intercom';
        this.relayPin = config.relayPin;
        this.voltagePin = config.voltagePin;

        this.relay = new Gpio(this.relayPin, 'out');
        this.voltageSensor = new Gpio(this.voltagePin, 'in', 'both');

        this.service = new Service.Switch(this.name);
        this.voltageService = new Service.ContactSensor(`${this.name} Bell`);

        this.service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));

        this.voltageService
            .getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getContactSensorState.bind(this));

        this.voltageSensor.watch(this.handleVoltageChange.bind(this));
    }

    getState(callback) {
        const isOn = this.relay.readSync() === 1;
        callback(null, isOn);
    }

    setState(value, callback) {
        this.relay.writeSync(value ? 1 : 0);
        callback(null);
    }

    getContactSensorState(callback) {
        // You can customize this logic based on your actual intercom bell behavior
        const isBellPressed = /* Logic to determine if bell is pressed */;
        callback(null, isBellPressed ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    }

    handleVoltageChange(err, value) {
        if (err) {
            this.log.error(err.message);
            return;
        }

        this.log(`Voltage value: ${value}`);
        // Add your code for further voltage measurement processing here
        // You can also trigger notifications when the voltage changes if needed
        this.voltageService.setCharacteristic(Characteristic.ContactSensorState, value === 1 ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    }

    getServices() {
        return [this.service, this.voltageService];
    }
}

module.exports = (homebridge) => {
    homebridge.registerAccessory('homebridge-intercom', 'Intercom', IntercomAccessory);
};
