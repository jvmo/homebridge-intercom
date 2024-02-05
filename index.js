var _ = require('underscore');
var rpio = require('rpio');
var Service, Characteristic, HomebridgeAPI;

const STATE_UNSECURED = 0;
const STATE_SECURED = 1;
const STATE_JAMMED = 2;
const STATE_UNKNOWN = 3;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;

  homebridge.registerAccessory('homebridge-intercom-door', 'IntercomDoor', ElectromagneticLockAccessory);
}

function ElectromagneticLockAccessory(log, config) {
  _.defaults(config, { activeLow: true, unlockingDuration: 2, lockWithMemory: true });

  this.log = log;
  this.name = config['name'];
  this.lockPin = config['lockPin'];
  this.voltagePin = config['voltagePin'];
  this.initialState = config['activeLow'] ? rpio.HIGH : rpio.LOW;
  this.activeState = config['activeLow'] ? rpio.LOW : rpio.HIGH;
  this.unlockingDuration = config['unlockingDuration'];
  this.lockWithMemory = config['lockWithMemory'];

  this.cacheDirectory = HomebridgeAPI.user.persistPath();
  this.storage = require('node-persist');
  this.storage.initSync({ dir: this.cacheDirectory, forgiveParseErrors: true });

  var cachedCurrentState = this.storage.getItemSync(this.name);
  if ((cachedCurrentState === undefined) || (cachedCurrentState === false)) {
    this.currentState = STATE_UNKNOWN;
  } else {
    this.currentState = cachedCurrentState;
  }

  this.lockState = this.currentState;
  if (this.currentState == STATE_UNKNOWN) {
    this.targetState = STATE_SECURED;
  } else {
    this.targetState = this.currentState;
  }

  this.service = new Service.LockMechanism(this.name);

  this.infoService = new Service.AccessoryInformation();
  this.infoService
    .setCharacteristic(Characteristic.Manufacturer, 'jvmo')
    .setCharacteristic(Characteristic.Model, 'homebridge-intercom-door')
    .setCharacteristic(Characteristic.SerialNumber, 'Version 1.0.0');

  this.unlockTimeout;

  // use gpio pin numbering
  rpio.init({ mapping: 'gpio' });
  rpio.open(this.lockPin, rpio.OUTPUT, this.initialState);

  // Add voltage measurement setup
  rpio.open(this.voltagePin, rpio.INPUT);
  rpio.poll(this.voltagePin, this.calculateLockWithMemoryState.bind(this));

  this.service
    .getCharacteristic(Characteristic.LockCurrentState)
    .on('get', this.getCurrentState.bind(this));

  this.service
    .getCharacteristic(Characteristic.LockTargetState)
    .on('get', this.getTargetState.bind(this))
    .on('set', this.setTargetState.bind(this));
}

// The rest of the functions remain the same...

ElectromagneticLockAccessory.prototype.measureVoltage = function() {
  // Read voltage from the GPIO pin
  let voltageValue = rpio.read(this.voltagePin);

  // Assuming a simple linear relationship between voltage and GPIO value
  // You might need to adjust this based on your voltage divider and measurement setup
  // For example: let voltageValue = rpio.read(this.voltagePin);
  // Then convert voltageValue to actual voltage using a formula
  return voltageValue * 5.0; // Assuming Vcc is 5V
}

ElectromagneticLockAccessory.prototype.calculateLockWithMemoryState = function() {
  rpio.msleep(20);
  // Measure voltage here and update lock state accordingly
  let voltage = this.measureVoltage();

  // Adjust this threshold based on your specific setup
  let yourThreshold = 2.5; // Example threshold, you may need to adjust

  if (voltage > yourThreshold) {
    // Implement your logic based on voltage measurement
    // For example, update lock states based on different voltage levels
    if (voltage > 4.0) {
      this.currentState = STATE_SECURED;
      this.targetState = STATE_SECURED;
    } else {
      this.currentState = STATE_UNSECURED;
      this.targetState = STATE_UNSECURED;
    }
  } else {
    // Handle case when voltage is below the threshold
    // You might want to implement additional logic based on your requirements
    this.currentState = STATE_UNKNOWN;
    this.targetState = STATE_UNKNOWN;
  }

  this.service.updateCharacteristic(Characteristic.LockTargetState, this.targetState);
  this.service.updateCharacteristic(Characteristic.LockCurrentState, this.currentState);
  this.storage.setItemSync(this.name, this.currentState);
}
