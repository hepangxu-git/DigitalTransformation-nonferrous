export interface FurnaceData {
  id: number;
  name: string;
  temperature: number;
  pressure: number;
  status: 'normal' | 'warning' | 'error';
  timestamp: number;
}

export interface TemperaturePoint {
  time: string;
  temperature: number;
  furnaceId: number;
}

export interface MonitorState {
  furnaces: FurnaceData[];
  temperatureHistory: TemperaturePoint[];
  isConnected: boolean;
}
