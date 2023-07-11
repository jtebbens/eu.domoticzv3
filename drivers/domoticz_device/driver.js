'use strict';

const Homey = require('homey');
const Domoticz = require('domoticz');



const CAPABILITY_TARGET_TEMPERATURE = 'target_temperature';
const CAPABILITY_MEASURE_TEMPERATURE = 'measure_temperature';
const CAPABILITY_MEASURE_POWER = 'measure_power';
const CAPABILITY_METER_POWER = 'meter_power';
const CAPABILITY_MEASURE_HUMIDITY = 'measure_humidity';
const CAPABILITY_METER_GAS = 'meter_gas';
const CAPABILITY_ONOFF = 'onoff';
const CAPABILITY_FANSPEED = 'fan_speed';
const CAPABILITY_WIND_ANGLE = 'measure_wind_angle';
const CAPABILITY_WIND_STRENGTH = 'measure_wind_strength';

const CAPABILITY_CUMULATIVE_POWER_HIGH = "power_meter_cumulative_high";
const CAPABILITY_CUMULATIVE_POWER_LOW = "power_meter_cumulative_low";
const CAPABILITY_CUMULATIVE_GAS = "gas_meter_cumulative";
const CAPABILITY_MEASURE_VOLTAGE = "measure_voltage";
const CAPABILITY_MEASURE_RAIN = "measure_rain";
const CAPABILITY_METER_RAIN = "meter_rain";

const DEVICE_DEFAULT_NAME = "Domoticz device";

const RETRY_INTERVAL = 10000;

const POLL_INTERVAL = 1000 * 10; // 10 seconds


class DomoticzDriver extends Homey.Driver{

    constructor(...args) {
        super(...args);
        this.deviceList = new Set(); // Initialize the deviceList variable
      }


    async onInit(){
        console.log("Initialize driver");

        //this.onPollInterval = setInterval(this.onPoll.bind(this), POLL_INTERVAL);
        //this.domoticz = new Domoticz.fromSettings(this.homey);
        let settings = this.homey.settings.get("domotics_config");
        console.log("Settings at onInit: ",settings);
        
        const domoticz = new Domoticz(settings);
        this.domoticz = Domoticz.fromSettings(this.homey);

        
        this.initInterval();
    }



    initInterval() {
        this.interval = setInterval(() => {
          this.onIntervalTick();
        }, 10000); // Interval set to 10 seconds (10000 milliseconds)
    }

    async onIntervalTick() {
        const domoticz = this.getDomoticz(); // Store the reference to the initialized Domoticz object
        //this.domoticz = Domoticz.fromSettings(this.homey);

        await domoticz.getDeviceData(null)
            .then((result) => {
                this.emit("domoticzdata", result);
            })
            .catch((error) => {
                this.emit("domoticzdataerror", error);
                console.log('Unable to retrieve state of device');
                console.log(error);
            });
      }


        /**

        this.getDevices().forEach((d)=>{
            Homey.app.doLog('Get data for device: '+d.getData().idx);
            this.getDomoticz().getDeviceData(d.getData().idx).then((result)=>{
                Homey.app.doLog("Got device data");
                Homey.app.doLog('Data: '+result);
                this._updateInternalState(d,result[0]);
            }).catch((error)=>{
               Homey.app.doError('Unable to retrieve state of device');
               Homey.app.doError(error);
            });
        });
    **/

        onPoll() {
            this.getDevices().forEach((d)=>{
                console.log('Get data for device: '+d.getData().idx);
                this.getDomoticz().getDeviceData(d.getData().idx).then((result)=>{
                    console.log("Got device data");
                    console.log('Data: '+result);
                    this._updateInternalState(d,result[0]);
                }).catch((error)=>{
                    console.log('Unable to retrieve state of device');
                    console.log(error);
                });
            });
          }
    
        onDeleted() {
            if( this.onPollInterval ) {
              clearInterval(this.onPollInterval);
            }
          }

    updateExternalState(values,device){
        console.log('Update external state of the device');
        console.log(values);

        let idx = device.getData().idx;

        Object.keys(values).forEach((key)=>{
           switch(key){
               case CAPABILITY_ONOFF:
                   let switchcommand = (values[key] === true ? 'On' : 'Off');

                   this.domoticz.updateDevice('switchlight',idx,switchcommand,null).then((data)=>{
                        console.log('Succesfully updated state external');
                        console.log(data);
                        return true;
                   }).catch((error)=>{
                        console.log('Error while updating device in domoticz');
                        console.log(error);
                       return false;
                   });
               break;
               case CAPABILITY_TARGET_TEMPERATURE:
                   this.domoticz.updateDevice('setsetpoint',idx,values[key],null).then((data)=>{
                        console.log('Succesfully updated state external');
                        console.log(data);
                   }).catch((error)=>{
                        console.log('Error while updating setpoint in domoticz');
                        console.log(error);
                    });
                    break;
               default:
                   return true;
           }
        });

    }

    getDomoticz(){
        if(this.domoticz == null){
            console.log('Initialize new domoticz class');
            this.domoticz = Domoticz.fromSettings();
            this.domoticz = this.homey.settings.get("domotics_config");
        }
        return this.domoticz;
    }

    onPair(socket){
        socket.showView('start',(data,callback)=>{
            console.log("Start pairing. Retrieve connect settings");

            this.retrieveSettings(data,callback);
        });

        socket.nextView('validate',(data,callback)=>{
            console.log("Validate new connection settings");
           this.validateSettings(data,callback);
        });

        socket.done();

        socket.setHandler('list_devices',(data,callback)=>{
            console.log("List new devices");
            this.onPairListDevices(data,callback);
            socket.emit("success", callback); // test
        });
    }

    validateSettings(data,callback){
        console.log("Validating credentials");
        console.log(data);
        let d = new Domoticz(data.username,data.password,data.host,data.port);
        d.findDevice(null,null,null).then((result)=>{
            if(result != null){
                console.log("Retrieve data");
                console.log(result);

            }
            console.log("save settings");
            //this.homey.settings.set('domotics_config',data);
            this.saveSettings(data);
            callback(null,'OK');
        }).catch((error)=>{
            console.log("Credentials are not correct or domoticz is not reachable!");
            callback(error,null);
        });
    }

    saveSettings(data){
        this.homey.settings.set('domotics_config',data);
    }

    fromSettings(){
        
        console.log("Retrieve connector from settings");
        let settings = this.homey.settings.get("domotics_config");
        console.log(settings);
        if(settings) {
            return new Domoticz(settings.username, settings.password, settings.host, settings.port);
        }
        return null;
    }


    static retrieveSettings(data,callback){
        this.homey = homey;
        console.log("Retrieve current settings from Homey store");
        let settings = this.homey.settings.get('domotics_config');
        if(settings === undefined || settings === null){
            settings = {
                "username": "",
                "password": "",
                "host": "",
                "port": "",
            }
        }

        callback(null,settings);
    }

    getDeviceClass(deviceEntry){
        switch(deviceEntry.Type){
            case 'Humidity':
                return 'sensor';
            case 'Light/Switch':
                return 'light';
            case 'Thermostat':
                return 'thermostat';
            default:
                return 'sensor';
        }
    }

    getDeviceCapabilities(deviceEntry){
        let capabilities = new Set();
        console.log("Get capabilities for device");
        console.log(deviceEntry.idx);
        switch(deviceEntry.Type){
            case "Humidity":
                capabilities.add(CAPABILITY_MEASURE_HUMIDITY);
                break;
            case "Temp":
                capabilities.add(CAPABILITY_MEASURE_TEMPERATURE);
                break;
            case "Temp + Humidity":
                capabilities.add(CAPABILITY_MEASURE_TEMPERATURE);
                capabilities.add(CAPABILITY_MEASURE_HUMIDITY);
                break;
            case "Light/Switch":
            case "Lighting2":
            case "Lighting 2":
                capabilities.add(CAPABILITY_ONOFF);
                if(deviceEntry.hasOwnProperty("HaveDimmer") && deviceEntry.HaveDimmer === true && deviceEntry.DimmerType !== "none"){
                    capabilities.add("dim");
                }
                break;
            case "Color Switch":
                // TODO need to find a way to dimm the lights.
                capabilities.add(CAPABILITY_ONOFF);
                break;
            case "Wind":
                capabilities.add(CAPABILITY_WIND_ANGLE);
                capabilities.add(CAPABILITY_WIND_STRENGTH);
                break;
            case "Rain":
                if(deviceEntry.hasOwnProperty("Rain")){
                    capabilities.add(CAPABILITY_MEASURE_RAIN);
                }

                if(deviceEntry.hasOwnProperty("RainRate")){
                    capabilities.add(CAPABILITY_METER_RAIN);
                }
                break;
            case "Security":
                break;
            case "Usage":
                if(deviceEntry.SubType === "Electric"){
                    capabilities.add(CAPABILITY_MEASURE_POWER);
                }
                break;


        }

        switch(deviceEntry.SubType){
            case "Gas":
                capabilities.add(CAPABILITY_METER_GAS);
                capabilities.add(CAPABILITY_CUMULATIVE_GAS);
                break;
                case "Energy":
                capabilities.add(CAPABILITY_MEASURE_POWER);
                capabilities.add(CAPABILITY_METER_POWER);
                capabilities.add(CAPABILITY_CUMULATIVE_POWER_HIGH);
                capabilities.add(CAPABILITY_CUMULATIVE_POWER_LOW);
                break;
            case "WTGR800":
                if(deviceEntry.hasOwnProperty("Humidity")){
                    capabilities.add(CAPABILITY_MEASURE_HUMIDITY);
                }

                if(deviceEntry.hasOwnProperty("Temp" )){
                    capabilities.add(CAPABILITY_MEASURE_TEMPERATURE);
                }
                break;
            case "Fan":
                capabilities.add(CAPABILITY_FANSPEED);
                break;
            case "SetPoint":
                capabilities.add(CAPABILITY_TARGET_TEMPERATURE);
                break;
            case "Voltage":
                capabilities.add(CAPABILITY_MEASURE_VOLTAGE);
                break;
        }
        console.log("Capabilities found: ");
        console.log(capabilities);

        return capabilities;
    }

    onPairListDevices(data, callback) {
        console.log("On pair list devices");
      
        let domoticz = this.getDomoticz();
      
        if (!domoticz) {
          callback(new Error("Failed to initialize Domoticz"), null);
          return;
        }
      
        domoticz
          .findDevice(null, null, null)
          .then((result) => {
            let devices = [];
      
            result.forEach((element) => {
              if (!this.deviceList.has(element.idx)) {
                let capabilities = this.getDeviceCapabilities(element);
                let deviceClass = this.getDeviceClass(element);
                console.log(capabilities);
                console.log(deviceClass);
      
                if (capabilities.size > 0 && deviceClass != null) {
                  devices.push({
                    name: element.Name || DEVICE_DEFAULT_NAME,
                    class: deviceClass,
                    capabilities: Array.from(capabilities),
                    data: {
                      id: this.guid(),
                      idx: element.idx,
                    },
                  });
                } else {
                  console.log("Could not determine device class or capabilities for device");
                  console.log(element);
                }
              }
            });
      
            console.log("Devices found: ",devices.length);
            console.log(devices);
            //callback(null, devices);
            return devices;
          })
          .catch((error) => {
            console.log("Error while retrieving devicelist");
            console.log(error);
            callback(error, null);
          });
      }
      

    guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    onDeleted() {
        if( this.onPollInterval ) {
          clearInterval(this.onPollInterval);
        }
      }


}

module.exports = DomoticzDriver;
