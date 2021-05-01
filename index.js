const SmartApp = require('@smartthings/smartapp');

const { NODE_ENV } = process.env;

const smartapp = new SmartApp()
  .configureI18n()
  .page('mainPage', (context, page, configData) => {
    page.section('thermostat_choose', section => {
      section
        .deviceSetting('thermostat')
        .capabilities(['temperatureMeasurement', 'thermostatCoolingSetpoint', 'thermostatHeatingSetpoint', 'thermostatMode'])
        .permissions('rwx')
        .required(true);
    });
  })
  .updated(async (context) => {
    await context.api.schedules.delete();
    return context.api.schedules.schedule('scheduleHandler', '0/5 * * * ? *', 'UTC');
  })
  .scheduledEventHandler('scheduleHandler', async (context) => {
    const { thermostat } = context.config;
    const thermostatId = thermostat && thermostat.length > 0 && thermostat[0].deviceConfig.deviceId;
    if (!thermostatId) {
      return;
    }
    const status = await context.api.devices.getStatus(thermostatId);
    const currentTemp = status.components.main.temperatureMeasurement.temperature.value;
    const heatingSetpoint = status.components.main.thermostatHeatingSetpoint.heatingSetpoint.value;
    const coolingSetpoint = status.components.main.thermostatCoolingSetpoint.coolingSetpoint.value;
    const mode = status.components.main.thermostatMode.thermostatMode.value;
    if (currentTemp < heatingSetpoint && mode === 'cool') {
      return context.api.devices.sendCommands(thermostat, [{ capability: 'thermostatMode', command: 'setThermostatMode', arguments: ['heat'] }]);
    } 
    if (currentTemp > coolingSetpoint && mode === 'heat') {
      return context.api.devices.sendCommands(thermostat, [{ capability: 'thermostatMode', command: 'setThermostatMode', arguments: ['cool'] }]);
    }
  });

if (NODE_ENV !== 'production') {
    smartapp.enableEventLogging(2);
}

exports.index = (req, res) => {
  req.url = '/st-handler';
  smartapp.handleHttpCallback(req, res);
};
