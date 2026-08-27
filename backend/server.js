const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

/* ============================================================
 *  内存数据存储
 * ============================================================ */

const equipment = [
  { id: 1, name: '1# 熔炼炉', temp: 1280, pressure: 2.8, status: 'normal' },
  { id: 2, name: '2# 熔炼炉', temp: 1260, pressure: 2.6, status: 'normal' },
  { id: 3, name: '3# 熔炼炉', temp: 1290, pressure: 2.9, status: 'normal' },
  { id: 4, name: '4# 熔炼炉', temp: 1270, pressure: 2.7, status: 'normal' },
  { id: 5, name: '5# 熔炼炉', temp: 1285, pressure: 2.8, status: 'normal' },
  { id: 6, name: '6# 熔炼炉', temp: 1275, pressure: 2.75, status: 'normal' },
];

const orders = [
  { id: 1,  orderNo: 'WO-2024-001', productName: '阴极铜', planQuantity: 5000, completedQuantity: 1200, status: 'in_progress' },
  { id: 2,  orderNo: 'WO-2024-002', productName: '阳极铜', planQuantity: 3000, completedQuantity: 3000, status: 'completed' },
  { id: 3,  orderNo: 'WO-2024-003', productName: '电解铜', planQuantity: 4000, completedQuantity: 800,  status: 'in_progress' },
  { id: 4,  orderNo: 'WO-2024-004', productName: '铜精矿', planQuantity: 6000, completedQuantity: 0,    status: 'pending' },
  { id: 5,  orderNo: 'WO-2024-005', productName: '粗铜',   planQuantity: 2500, completedQuantity: 600,  status: 'in_progress' },
  { id: 6,  orderNo: 'WO-2024-006', productName: '冰铜',   planQuantity: 3500, completedQuantity: 3500, status: 'completed' },
  { id: 7,  orderNo: 'WO-2024-007', productName: '阳极泥', planQuantity: 1000, completedQuantity: 200,  status: 'in_progress' },
  { id: 8,  orderNo: 'WO-2024-008', productName: '白银',   planQuantity: 800,  completedQuantity: 0,    status: 'pending' },
  { id: 9,  orderNo: 'WO-2024-009', productName: '硫酸铜', planQuantity: 2000, completedQuantity: 450,  status: 'in_progress' },
  { id: 10, orderNo: 'WO-2024-010', productName: '铜杆',   planQuantity: 3200, completedQuantity: 0,    status: 'pending' },
];

let alerts = [];
let alertIdSeq = 100;

/* ============================================================
 *  工具函数
 * ============================================================ */

function now() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, data: payload, time: now() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function updateDeviceStatus(device) {
  if (device.temp > 1400 || device.pressure > 3.5) {
    device.status = 'alert';
  } else if (device.temp > 1380 || device.pressure > 3.3) {
    device.status = 'warning';
  } else {
    device.status = 'normal';
  }
}

/* ============================================================
 *  RESTful API
 * ============================================================ */

app.get('/api/equipment', (_req, res) => {
  res.json({ code: 0, data: equipment });
});

app.get('/api/orders', (_req, res) => {
  res.json({ code: 0, data: orders });
});

app.post('/api/orders/:id/start', (req, res) => {
  const order = orders.find(o => o.id === +req.params.id);
  if (!order) return res.status(404).json({ code: 1, message: '工单不存在' });
  if (order.status !== 'pending') return res.status(400).json({ code: 1, message: '当前状态不允许开始' });
  order.status = 'in_progress';
  broadcast('order_update', order);
  res.json({ code: 0, data: order });
});

app.post('/api/orders/:id/complete', (req, res) => {
  const order = orders.find(o => o.id === +req.params.id);
  if (!order) return res.status(404).json({ code: 1, message: '工单不存在' });
  if (order.status !== 'in_progress') return res.status(400).json({ code: 1, message: '当前状态不允许完成' });
  order.status = 'completed';
  order.completedQuantity = order.planQuantity;
  broadcast('order_update', order);
  res.json({ code: 0, data: order });
});

app.post('/api/orders/:id/abnormal', (req, res) => {
  const order = orders.find(o => o.id === +req.params.id);
  if (!order) return res.status(404).json({ code: 1, message: '工单不存在' });
  order.status = 'abnormal';
  broadcast('order_update', order);
  res.json({ code: 0, data: order });
});

app.post('/api/alerts', (req, res) => {
  const { deviceId, deviceName, alertType, level } = req.body;
  const alert = {
    id: alertIdSeq++,
    deviceId: deviceId || 0,
    deviceName: deviceName || '未知设备',
    alertType: alertType || '温度超限',
    level: level || 'warning',
    time: now(),
    status: 'active',
  };
  alerts.unshift(alert);
  if (alerts.length > 100) alerts = alerts.slice(0, 100);
  broadcast('alert_trigger', alert);
  res.json({ code: 0, data: alert });
});

app.put('/api/alerts/:id/resolve', (req, res) => {
  const alert = alerts.find(a => a.id === +req.params.id);
  if (!alert) return res.status(404).json({ code: 1, message: '告警不存在' });
  alert.status = 'resolved';
  broadcast('alert_resolved', alert);
  res.json({ code: 0, data: alert });
});

/* ============================================================
 *  WebSocket
 * ============================================================ */

wss.on('connection', ws => {
  console.log('[WS] client connected, total:', wss.clients.size);

  ws.send(JSON.stringify({
    type: 'init',
    data: { equipment, orders, alerts: alerts.slice(0, 20) },
    time: now(),
  }));

  ws.on('close', () => {
    console.log('[WS] client disconnected, total:', wss.clients.size);
  });
});

/* ============================================================
 *  模拟数据自动更新（每 5 秒）
 * ============================================================ */

setInterval(() => {
  equipment.forEach(device => {
    const oldStatus = device.status;

    device.temp = Math.round((device.temp + (Math.random() - 0.5) * 10) * 10) / 10;
    device.pressure = Math.round((device.pressure + (Math.random() - 0.5) * 0.2) * 100) / 100;

    device.temp = Math.max(1200, Math.min(1450, device.temp));
    device.pressure = Math.max(2.0, Math.min(4.0, device.pressure));

    updateDeviceStatus(device);

    if (device.temp > 1380 && oldStatus !== 'alert') {
      const alert = {
        id: alertIdSeq++,
        deviceId: device.id,
        deviceName: device.name,
        alertType: device.temp > 1400 ? '温度超限告警' : '温度偏高预警',
        level: device.temp > 1400 ? 'error' : 'warning',
        time: now(),
        status: 'active',
      };
      alerts.unshift(alert);
      if (alerts.length > 100) alerts = alerts.slice(0, 100);
      broadcast('alert_trigger', alert);
    }
  });

  broadcast('device_update', equipment);
}, 5000);

/* ============================================================
 *  启动服务
 * ============================================================ */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('WebSocket server ready');
});
