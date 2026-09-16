// Explicitly seeded building-level mock data for the developer/portfolio screen.
// Independent of the simulated apt_401 device/event pipeline -- energy and
// maintenance numbers here are fixed demo values, never inferred from device state.
export function seedPortfolio() {
  return [
    { apartmentId: 'apt_401', unit: '401', fleetHealth: 'healthy', energyKwhToday: 4.8, maintenanceOpen: 0, maintenancePriority: null, handoverStatus: 'occupied', occupants: 2 },
    { apartmentId: 'apt_502', unit: '502', fleetHealth: 'attention', energyKwhToday: 6.1, maintenanceOpen: 1, maintenancePriority: 'medium', handoverStatus: 'occupied', occupants: 1 },
    { apartmentId: 'apt_210', unit: '210', fleetHealth: 'anomaly', energyKwhToday: 7.9, maintenanceOpen: 2, maintenancePriority: 'high', handoverStatus: 'occupied', occupants: 3 },
    { apartmentId: 'apt_318', unit: '318', fleetHealth: 'healthy', energyKwhToday: 3.2, maintenanceOpen: 0, maintenancePriority: null, handoverStatus: 'vacant', occupants: 0 },
    { apartmentId: 'apt_115', unit: '115', fleetHealth: 'healthy', energyKwhToday: 5.0, maintenanceOpen: 1, maintenancePriority: 'low', handoverStatus: 'pending_handover', occupants: 0 },
    { apartmentId: 'apt_407', unit: '407', fleetHealth: 'attention', energyKwhToday: 5.6, maintenanceOpen: 1, maintenancePriority: 'medium', handoverStatus: 'occupied', occupants: 2 },
  ];
}
