# homebridge-intercom-door
homebridge-intercom plugin base on Raspberry Pi Zero W and a single relay.

##Relay Connections: 
#VCC from relay to 5V on Raspberry Pi Zero W. 
#GND from relay to GND on Raspberry Pi Zero W. 
#IND from relay to GPIO 7 on Raspberry Pi Zero W.

##Voltage Measurement (Using Voltage Divider): 
#Connect one leg of the resistor to the voltage source. 
#Connect the other leg of the resistor to a GPIO 17 pin on Raspberry Pi Zero W. 
#Connect the junction between the resistor and the GPIO pin to the ground (GND) on Raspberry Pi Zero W.

The function in the code for any voltage measurement is triggered by this setup and after it is triggered, it sends a notification to the Home app saying "Bell was pressed". All the codes I fixed and created were based on this. 😊

The voltage measurement setup is a simple voltage divider circuit that reduces the voltage from the source (such as a doorbell button) to a level that is safe for the Raspberry Pi GPIO pin. The resistor acts as a current limiter and protects the GPIO pin from being damaged by high voltage. The voltage pin (GPIO 17) is set as an input with both edge detection, which means it will detect any changes in the voltage level (from low to high or high to low). When the voltage pin detects a high voltage (1), it means the voltage source is activated (the doorbell button is pressed). When the voltage pin detects a low voltage (0), it means the voltage source is deactivated (the doorbell button is released).

The code uses the `onoff` module to control the GPIO pins and the `axios` module to make HTTP requests to the REST API server. The code also uses the `uuid` module to generate a unique identifier for the accessory. The code creates a new accessory with two services: a switch service for the relay and a contact sensor service for the voltage. The code listens for the `get` and `set` events on the switch service and the `get` event on the contact sensor service. The code also listens for the `watch` event on the voltage pin, which is triggered whenever the voltage changes. The code uses the `sendNotification` function to send a message to the REST API server, which then sends a notification to the Home app using the Homebridge REST API plugin.

I hope this explains how the code works
#Install the plugin using the following command:

```bash
npm install -g homebridge-intercom-door
