import { AccessoryPlugin, API, HAP, Logging, Service } from "homebridge";
import _ from "underscore";
import rpio from "rpio";

const STATE_UNSECURED = 0;
const STATE_SECURED = 1;
const STATE_JAMMED = 2;
const STATE_UNKNOWN = 3;

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("homebridge-intercom-door", "ElectromagneticLock", ElectromagneticLockAccessory);
};

class ElectromagneticLockAccessory implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly lockPin: number;
  private readonly doorPin: number;
  private readonly initialState: number;
  private readonly activeState: number;
  private readonly reedSwitchActiveState: number;
  private readonly unlockingDuration: number;
  private readonly lockWithMemory: boolean;
  private readonly voltagePin: number;
  private readonly cacheDirectory: string;
  private readonly storage: any;
  private currentState: number;
  private lockState: number;
  private targetState: number;
  private readonly service: Service;
  private readonly infoService: Service;
  private unlockTimeout: NodeJS.Timeout;

  constructor(log: Logging, config: any, api: API) {
    _.defaults(config, { activeLow: true, reedSwitchActiveLow: true, unlockingDuration: 2, lockWithMemory: true });

    this.log = log;
    this.name = config["name"];
    this.lockPin = config["lockPin"];
    this.doorPin = config["doorPin"];
    this.initialState = config["activeLow"] ? rpio.HIGH : rpio.LOW;
    this.activeState = config["activeLow"] ? rpio.LOW : rpio.HIGH;
    this.reedSwitchActiveState = config["reedSwitchActiveLow"] ? rpio.LOW : rpio.HIGH;
    this.unlockingDuration = config["unlockingDuration"];
    this.lockWithMemory = config["lockWithMemory"];

    // GPIO pin for voltage measurement
    this.voltagePin = 17; // GPIO 17

    // Setup the voltage pin as an input with both edge detection
    rpio.open(this.voltagePin, rpio.INPUT, rpio.PULL_DOWN);
    rpio.poll(this.voltagePin, this.handleVoltageChange.bind(this), rpio.POLL_BOTH);

    this.cacheDirectory = api.user.persistPath();
    this.storage = require("node-persist");
    this.storage.initSync({ dir: this.cacheDirectory, forgiveParseErrors: true });

    const cachedCurrentState = this.storage.getItemSync(this.name);
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

    this.service = new hap.Service.LockMechanism(this.name);

    this.infoService = new hap.Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(hap.Characteristic.Manufacturer, "jvmo")
      .setCharacteristic(hap.Characteristic.Model, "Intercom Door")
      .setCharacteristic(hap.Characteristic.SerialNumber, "1234567890");

    this.unlockTimeout;

    // use gpio pin numbering
    rpio.init({ mapping: "gpio" });
    rpio.open(this.lockPin, rpio.OUTPUT, this.initialState);

    if (this.doorPin && !this.lockWithMemory) {
      this.log("Electromagnetic lock without memory doesn't support doorPin, setting to null. Consider using a separate contact sensor.");
      this.doorPin = undefined;
    }

    if (this.doorPin) {
      rpio.open(this.doorPin, rpio.INPUT);
      if (this.lockWithMemory) {
        rpio.poll(this.doorPin, this.calculateLockWithMemoryState.bind(this));
      }
    }

    this.service
      .getCharacteristic(hap.Characteristic.LockCurrentState)
      .on("get", this.getCurrentState.bind(this));

    this.service
      .getCharacteristic(hap.Characteristic.LockTargetState)
      .on("get", this.getTargetState.bind(this))
      .on("set", this.setTargetState.bind(this));
  }

  getServices(): Service[] {
    return [this.infoService, this.service];
  }

  async getCurrentState(callback: any) {
    this.log("Lock current state: %s", this.currentState);
    callback(null, this.currentState);
  }

  async getTargetState(callback: any) {
    this.log("Lock target state: %s", this.targetState);
    callback(null, this.targetState);
  }

  async setTargetState(state: any, callback: any) {
    this.log("Setting lock to %s", state ? "secured" : "unsecured");
    if (state && this.lockWithMemory) {
      this.log("Can't lock electromagnetic lock with memory.");
      this.service.updateCharacteristic(hap.Characteristic.LockCurrentState, state);
      setTimeout(() => {
        this.service.updateCharacteristic(hap.Characteristic.LockTargetState, this.targetState);
        this.service.updateCharacteristic(hap.Characteristic.LockCurrentState, this.currentState);
      }, 1000);
      callback(null);
      return;
    }
    this.targetState = state;
    rpio.write(this.lockPin, state ? this.initialState : this.activeState);
    if (!state) {
      this.unlockTimeout = setTimeout(() => {
        rpio.write(this.lockPin, this.initialState);
        this.targetState = STATE_SECURED;
        this.service.updateCharacteristic(hap.Characteristic.LockTargetState, this.targetState);
      }, this.unlockingDuration * 1000);
    } else {
      clearTimeout(this.unlockTimeout);
    }
    this.calculateState();
    callback(null);
  }

  async calculateState() {
    if (this.doorPin) {
      const doorState = rpio.read(this.doorPin);
      if (doorState == this.reedSwitchActiveState) {
        this.currentState = STATE_UNSECURED;
      } else {
        this.currentState = STATE_SECURED;
      }
    } else {
      this.currentState = this.targetState;
    }
    this.service.updateCharacteristic(hap.Characteristic.LockCurrentState, this.currentState);
    this.storage.setItemSync(this.name, this.currentState);
  }

  async calculateLockWithMemoryState() {
    const doorState = rpio.read(this.doorPin);
    if (doorState == this.reedSwitchActiveState) {
      this.lockState = STATE_UNSECURED;
      rpio.write(this.lockPin, this.activeState);
    } else {
      this.lockState = STATE_SECURED;
      rpio.write(this.lockPin, this.initialState);
    }
    this.calculateState();
  }

  async handleVoltageChange() {
    const voltageState = rpio.read(this.voltagePin);
    if (voltageState == rpio.HIGH) {
      this.log("Power supply is OK.");
    } else {
      this.log("Power supply is LOW.");
    }
  }
}
