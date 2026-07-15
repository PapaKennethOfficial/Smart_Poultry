// Farm logbook entries
export const logbookEntries = [
  { id: 'LOG-001', date: '2026-03-12', batch: 'Batch A - Broilers', feeding: '480 kg', eggs: 1240, mortality: 2, expenses: 'GHS 1,200', notes: 'Normal conditions' },
  { id: 'LOG-002', date: '2026-03-11', batch: 'Batch A - Broilers', feeding: '475 kg', eggs: 1185, mortality: 1, expenses: 'GHS 1,150', notes: 'Humidity slightly high' },
  { id: 'LOG-003', date: '2026-03-10', batch: 'Batch B - Layers', feeding: '390 kg', eggs: 980, mortality: 0, expenses: 'GHS 980', notes: 'All clear' },
  { id: 'LOG-004', date: '2026-03-09', batch: 'Batch B - Layers', feeding: '395 kg', eggs: 1020, mortality: 3, expenses: 'GHS 1,050', notes: 'Vet inspection done' },
  { id: 'LOG-005', date: '2026-03-08', batch: 'Batch A - Broilers', feeding: '500 kg', eggs: 1300, mortality: 0, expenses: 'GHS 1,320', notes: 'High production day' },
  { id: 'LOG-006', date: '2026-03-07', batch: 'Batch C - Noilers', feeding: '310 kg', eggs: 740, mortality: 1, expenses: 'GHS 870', notes: 'Feed adjusted' },
  { id: 'LOG-007', date: '2026-03-06', batch: 'Batch A - Broilers', feeding: '488 kg', eggs: 1210, mortality: 2, expenses: 'GHS 1,180', notes: 'Normal' },
];

// Delivery orders
export const deliveries = [
  { id: 'DEL-2026-001', customer: 'Kofi Supermart', product: 'Eggs (Crates)', qty: 40, status: 'Delivered', date: '2026-03-12', driver: 'Kwame A.', amount: 'GHS 2,400' },
  { id: 'DEL-2026-002', customer: 'Accra Fresh Market', product: 'Broilers (Live)', qty: 120, status: 'In Transit', date: '2026-03-12', driver: 'Emmanuel B.', amount: 'GHS 7,200' },
  { id: 'DEL-2026-003', customer: 'Good Shepherd Hotel', product: 'Eggs (Crates)', qty: 25, status: 'Pending', date: '2026-03-13', driver: 'Unassigned', amount: 'GHS 1,500' },
  { id: 'DEL-2026-004', customer: 'Tema Cold Store', product: 'Broilers (Frozen)', qty: 200, status: 'Pending', date: '2026-03-13', driver: 'Unassigned', amount: 'GHS 12,000' },
  { id: 'DEL-2026-005', customer: 'Osu Market Stall', product: 'Noilers (Live)', qty: 50, status: 'Delivered', date: '2026-03-11', driver: 'Kwame A.', amount: 'GHS 3,500' },
  { id: 'DEL-2026-006', customer: 'Legon Cafeteria', product: 'Eggs (Crates)', qty: 15, status: 'Cancelled', date: '2026-03-10', driver: 'N/A', amount: 'GHS 900' },
];

// Chart data - egg production 7 days
export const eggProductionData = [
  { day: 'Mon', eggs: 1100, target: 1200 },
  { day: 'Tue', eggs: 1240, target: 1200 },
  { day: 'Wed', eggs: 1185, target: 1200 },
  { day: 'Thu', eggs: 1300, target: 1200 },
  { day: 'Fri', eggs: 980,  target: 1200 },
  { day: 'Sat', eggs: 1020, target: 1200 },
  { day: 'Sun', eggs: 1210, target: 1200 },
];

// Feed conversion ratio
export const feedConversionData = [
  { week: 'Wk 1', ratio: 2.1, industry: 2.3 },
  { week: 'Wk 2', ratio: 2.0, industry: 2.3 },
  { week: 'Wk 3', ratio: 1.9, industry: 2.3 },
  { week: 'Wk 4', ratio: 2.2, industry: 2.3 },
  { week: 'Wk 5', ratio: 1.85, industry: 2.3 },
  { week: 'Wk 6', ratio: 1.9, industry: 2.3 },
];

// 10-day forecast
export const forecastData = [
  { day: 'Mar 13', predicted: 1220, confidence: 92 },
  { day: 'Mar 14', predicted: 1195, confidence: 90 },
  { day: 'Mar 15', predicted: 1250, confidence: 88 },
  { day: 'Mar 16', predicted: 1280, confidence: 85 },
  { day: 'Mar 17', predicted: 1230, confidence: 83 },
  { day: 'Mar 18', predicted: 1200, confidence: 80 },
  { day: 'Mar 19', predicted: 1175, confidence: 78 },
  { day: 'Mar 20', predicted: 1240, confidence: 76 },
  { day: 'Mar 21', predicted: 1260, confidence: 73 },
  { day: 'Mar 22', predicted: 1290, confidence: 70 },
];

// Environmental alerts
export const alerts = [
  { id: 1, type: 'warning', title: 'High Humidity - House B', message: 'Humidity at 82% — above 75% threshold. Ventilation recommended.', time: '2 hrs ago', color: '#f59e0b' },
  { id: 2, type: 'info', title: 'Feeding Schedule Due', message: 'Batch C afternoon feeding is due in 30 minutes.', time: '30 min ago', color: '#3b82f6' },
  { id: 3, type: 'success', title: 'AI Forecast Updated', message: 'Egg yield forecast updated for next 10 days. Expected: 1,220 eggs/day.', time: '1 hr ago', color: '#22c55e' },
  { id: 4, type: 'error', title: 'Mortality Alert - Batch A', message: '3 deaths recorded today. Monitor health status closely.', time: '4 hrs ago', color: '#ef4444' },
];

// Mortality trend
export const mortalityData = [
  { week: 'Wk 1', count: 5 },
  { week: 'Wk 2', count: 3 },
  { week: 'Wk 3', count: 7 },
  { week: 'Wk 4', count: 2 },
  { week: 'Wk 5', count: 4 },
  { week: 'Wk 6', count: 6 },
];

// Environmental sensor data
export const sensorData = [
  { time: '06:00', temp: 24, humidity: 68, ammonia: 12 },
  { time: '08:00', temp: 26, humidity: 70, ammonia: 14 },
  { time: '10:00', temp: 28, humidity: 72, ammonia: 15 },
  { time: '12:00', temp: 30, humidity: 74, ammonia: 18 },
  { time: '14:00', temp: 31, humidity: 76, ammonia: 19 },
  { time: '16:00', temp: 29, humidity: 80, ammonia: 17 },
  { time: '18:00', temp: 27, humidity: 78, ammonia: 15 },
  { time: '20:00', temp: 25, humidity: 74, ammonia: 13 },
];
