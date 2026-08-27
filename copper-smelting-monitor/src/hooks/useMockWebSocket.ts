import type { FurnaceData, TemperaturePoint } from '../types';

const WS_URL = 'ws://localhost:3000';
const HISTORY_SIZE = 72;

const historyData: Map<number, TemperaturePoint[]> = new Map();

function initHistory(): void {
  const now = Date.now();
  for (let i = 0; i < 6; i++) {
    const points: TemperaturePoint[] = [];
    for (let j = HISTORY_SIZE; j >= 0; j--) {
      const time = new Date(now - j * 20 * 60 * 1000);
      points.push({
        time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        temperature: 1250 + Math.random() * 150,
        furnaceId: i + 1,
      });
    }
    historyData.set(i + 1, points);
  }
}

initHistory();

function mapServerData(serverEquipment: any[]): FurnaceData[] {
  const now = Date.now();
  return serverEquipment.map((item: any) => {
    const id = item.id;
    const temperature = item.temp;
    const pressure = item.pressure;

    let status: FurnaceData['status'] = 'normal';
    if (item.status === 'alert' || temperature > 1400) status = 'error';
    else if (item.status === 'warning' || temperature > 1380) status = 'warning';

    const point: TemperaturePoint = {
      time: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      temperature,
      furnaceId: id,
    };

    const history = historyData.get(id) || [];
    history.push(point);
    if (history.length > HISTORY_SIZE) history.shift();
    historyData.set(id, history);

    return { id, name: item.name, temperature, pressure, status, timestamp: now };
  });
}

export function createMockWebSocket(
  onMessage: (data: FurnaceData[]) => void
): { start: () => void; stop: () => void } {
  let ws: WebSocket | null = null;
  let fallbackInterval: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WS] Connected to server');
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'device_update' || msg.type === 'init') {
            const equipmentData = msg.type === 'init' ? msg.data.equipment : msg.data;
            onMessage(mapServerData(equipmentData));
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, trying to reconnect...');
        ws = null;
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws?.close();
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      startFallback();
    }
  };

  const startFallback = () => {
    if (fallbackInterval) return;
    console.log('[WS] Using fallback mock data');
    const mockData: FurnaceData[] = Array.from({ length: 6 }, (_, i) => {
      const id = i + 1;
      const temperature = 1280 + Math.random() * 120;
      const pressure = 2.5 + Math.random() * 1.5;
      let status: FurnaceData['status'] = 'normal';
      if (temperature > 1400) status = 'error';
      else if (temperature > 1380) status = 'warning';
      return { id, name: `${id}# 熔炼炉`, temperature: Math.round(temperature * 10) / 10, pressure: Math.round(pressure * 100) / 100, status, timestamp: Date.now() };
    });
    onMessage(mockData);
    fallbackInterval = setInterval(() => {
      onMessage(mockData.map(f => ({
        ...f,
        temperature: Math.round((f.temperature + (Math.random() - 0.5) * 10) * 10) / 10,
        pressure: Math.round((f.pressure + (Math.random() - 0.5) * 0.2) * 100) / 100,
        timestamp: Date.now(),
      })));
    }, 2000);
  };

  return {
    start: () => connect(),
    stop: () => {
      ws?.close();
      ws = null;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    },
  };
}

export function getTemperatureHistory(): Map<number, TemperaturePoint[]> {
  return historyData;
}
