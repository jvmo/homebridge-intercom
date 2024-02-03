const Gpio = require('onoff').Gpio;

module.exports = function (homebridge) {
  const Accessory = homebridge.platformAccessory;
  const Service = homebridge.hap.Service;
  const Characteristic = homebridge.hap.Characteristic;
  const UUIDGen = homebridge.hap.uuid;

  class IntercomAccessory {
    constructor(log, config) {
      this.log = log;
      this.name = config.name;
      this.relayPin = new Gpio(config.relayPin, 'out');
      this.voltagePin = new Gpio(config.voltagePin, 'in', 'both');

      this.service = new Service.Switch(this.name);
      this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this.getSwitchOn.bind(this))
        .on('set', this.setSwitchOn.bind(this));

      this.voltagePin.watch(this.handleVoltageChange.bind(this));

      // Additional setup if needed
    }

    getSwitchOn(callback) {
      const isSwitchOn = this.relayPin.readSync() === 1;
      callback(null, isSwitchOn);
    }

    setSwitchOn(value, callback) {
      this.relayPin.writeSync(value ? 1 : 0);
      callback(null);
    }

    handleVoltageChange(err, value) {
      if (err) {
        this.log.error(`Voltage reading error: ${err}`);
        return;
      }

      // Use the voltage value as needed
      this.log(`Voltage reading: ${value}`);
    }

    // Additional methods if needed

    identify(callback) {
      this.log(`Identify requested for ${this.name}`);
      callback(null);
    }

    getServices() {
      return [this.service];
    }
  }

  homebridge.registerAccessory('homebridge-intercom', 'Intercom', IntercomAccessory);
};
