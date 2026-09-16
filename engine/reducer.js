// Devices change state ONLY through this function, and only in response to an Event.
export function applyEventToDevices(event, devices) {
  const device = devices.find((d) => d.id === event.deviceId);
  if (!device) return null;
  if (event.value && typeof event.value === 'object' && !Array.isArray(event.value)) {
    device.state = { ...device.state, ...event.value };
  }
  device.lastUpdated = event.timestamp;
  return device;
}
