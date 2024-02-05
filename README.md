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

#Install the plugin using the following command:

```bash
npm install -g homebridge-intercom-door
