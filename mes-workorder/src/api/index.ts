const API_BASE = 'https://digital-transformation-nonferrous.vercel.app';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '请求失败');
  return json.data;
}

export interface EquipmentItem {
  id: number;
  name: string;
  temp: number;
  pressure: number;
  status: 'normal' | 'warning' | 'alert';
}

export interface OrderItem {
  id: number;
  orderNo: string;
  productName: string;
  planQuantity: number;
  completedQuantity: number;
  status: 'pending' | 'in_progress' | 'completed' | 'abnormal';
}

export interface AlertItem {
  id: number;
  deviceId: number;
  deviceName: string;
  alertType: string;
  level: string;
  time: string;
  status: 'active' | 'resolved';
}

export const api = {
  getEquipment: () => request<EquipmentItem[]>('/api/equipment'),
  getOrders: () => request<OrderItem[]>('/api/orders'),
  startOrder: (id: number) => request<OrderItem>(`/api/orders/${id}/start`, { method: 'POST' }),
  completeOrder: (id: number) => request<OrderItem>(`/api/orders/${id}/complete`, { method: 'POST' }),
  abnormalOrder: (id: number) => request<OrderItem>(`/api/orders/${id}/abnormal`, { method: 'POST' }),
  createAlert: (data: Partial<AlertItem>) => request<AlertItem>('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),
  resolveAlert: (id: number) => request<AlertItem>(`/api/alerts/${id}/resolve`, { method: 'PUT' }),
};
