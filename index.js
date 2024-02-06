"use strict";

const axios = require("axios"); // for making HTTP requests
const uuid = require("uuid"); // for generating unique identifiers

module.exports = function (homebridge) {
  // register the accessory with the plugin name, the accessory name, and the accessory constructor
  homebridge.registerAccessory("homebridge-intercom-door", "Intercom Door", IntercomDoor);
};

// the accessory constructor
function IntercomDoor(log, config, api) {
  // get the accessory information from the config file
  this.name = config.name || "Intercom Door"; // the name of the accessory
  this.relayPin = config.relayPin || 7; // the GPIO pin for the relay
  this.voltagePin = config.voltagePin || 17; // the GPIO pin for the voltage measurement
  this.apiURL = config.apiURL || "http://localhost:8080"; // the URL of the REST API server
  this.log = log; // the logger object
  this.api = api; // the Homebridge API object

  // get the HAP object from the API
  const { Accessory, Service, Characteristic } = this.api.hap;

  // initialize the GPIO pins using the onoff library
  const Gpio = require("onoff").Gpio;
  this.relay = new Gpio(this.relayPin, "out"); // set the relay pin as an output
  this.voltage = new Gpio(this.voltagePin, "in", "both"); // set the voltage pin as an input with both edge detection

  // create a new accessory with the information service
  this.accessory = new Accessory(this.name, uuid.v4());
  this.informationService = this.accessory.getService(Service.AccessoryInformation);
  this.informationService
    .setCharacteristic(Characteristic.Manufacturer, "jvmo")
    .setCharacteristic(Characteristic.Model, "Intercom Door")
    .setCharacteristic(Characteristic.SerialNumber, "1234567890");

  // create a new switch service for the relay
  this.switchService = this.accessory.addService(Service.Switch, this.name);
  this.switchService
    .getCharacteristic(Characteristic.On) // get the on/off characteristic
    .on("get", this.getSwitchState.bind(this)) // bind the getter function
    .on("set", this.setSwitchState.bind(this)); // bind the setter function

  // create a new contact sensor service for the voltage
  this.contactService = this.accessory.addService(Service.ContactSensor, this.name);
  this.contactService
    .getCharacteristic(Characteristic.ContactSensorState) // get the contact sensor state characteristic
    .on("get", this.getContactState.bind(this)); // bind the getter function

  // listen for changes in the voltage pin
  this.voltage.watch((err, value) => {
    if (err) {
      this.log.error(err); // log the error
    } else {
      this.log.info("Voltage changed to " + value); // log the value
      this.contactService.updateCharacteristic(Characteristic.ContactSensorState, value); // update the contact sensor state
      if (value === 1) {
        this.sendNotification("Bell was pressed"); // send a notification if the voltage is high
      }
    }
  });
}

// the getter function for the switch state
IntercomDoor.prototype.getSwitchState = function (callback) {
  // read the value of the relay pin
  this.relay.read((err, value) => {
    if (err) {
      this.log.error(err); // log the error
      callback(err); // return the error
    } else {
      this.log.info("Switch state is " + value); // log the value
      callback(null, value); // return the value
    }
  });
};

// the setter function for the switch state
IntercomDoor.prototype.setSwitchState = function (value, callback) {
  // write the value to the relay pin
  this.relay.write(value, (err) => {
    if (err) {
      this.log.error(err); // log the error
      callback(err); // return the error
    } else {
      this.log.info("Switch state set to " + value); // log the value
      callback(); // return success
      if (value === 1) {
        this.sendNotification("Door is open"); // send a notification if the relay is on
      } else {
        this.sendNotification("Door is closed"); // send a notification if the relay is off
      }
    }
  });
};

// the getter function for the contact sensor state
IntercomDoor.prototype.getContactState = function (callback) {
  // read the value of the voltage pin
  this.voltage.read((err, value) => {
    if (err) {
      this.log.error(err); // log the error
      callback(err); // return the error
    } else {
      this.log.info("Contact sensor state is " + value); // log the value
      callback(null, value); // return the value
    }
  });
};

// the function to send a notification to the Home app
IntercomDoor.prototype.sendNotification = function (message) {
  // make a POST request to the REST API server with the message
  axios
    .post(this.apiURL + "/notify", { message: message })
    .then((response) => {
      this.log.info("Notification sent: " + message); // log the message
    })
    .catch((error) => {
      this.log.error(error); // log the error
    });
};
