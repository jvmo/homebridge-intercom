const rpio = require('rpio');
const { execSync } = require('child_process');
const { Accessory, Categories } = require('homebridge');
const { Service, Characteristic } = require('hap-nodejs');

class IntercomDoorPlugin {

  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    if (this.api) {
      this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    }
  }

  configureAccessory(accessory) {
    this.log(`${accessory.displayName} accessory has been added.`);
  }

  didFinishLaunching() {
    const { name, relayPin, voltagePin } = this.config;

    rpio.init({ mapping: 'gpio' });

    const accessory = new Accessory(name, Categories.DOORBELL);
    accessory.addService(Service.Doorbell, name);

    const relay = rpio.open(relayPin, rpio.OUTPUT, rpio.LOW);
    const voltage = rpio.open(voltagePin, rpio.INPUT);

    voltage.poll((pin) => {
      const voltageValue = rpio.read(pin);
      accessory.getService(Service.Doorbell)
        .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
        .updateValue(voltageValue);

      if (voltageValue) {
        this.log('Bell was pressed!');
        this.sendNotification('Bell was pressed');
      }
    }, rpio.POLL_HIGH);

    accessory.getService(Service.Doorbell)
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .on('set', (value, callback) => {
        this.log(`Door is ${value ? 'open' : 'closed'}`);
        this.sendNotification(`Door is ${value ? 'open' : 'closed'}`);
        rpio.write(relay, value ? rpio.HIGH : rpio.LOW);
        callback(null);
      });

    this.api.registerPlatformAccessories('homebridge-intercom-door', 'IntercomDoor', [accessory]);
  }

  sendNotification(message) {
    try {
      execSync(`echo ${message} | wall`);
    } catch (error) {
      this.log(`Error sending notification: ${error.message}`);
    }
  }
}

module.exports = (api) => {
  api.registerAccessory('homebridge-intercom-door', 'IntercomDoor', IntercomDoorPlugin);
};
