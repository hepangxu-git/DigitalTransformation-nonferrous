import { useEffect, useState } from 'react';
import type { FurnaceData } from '../types';

interface FurnaceCardProps {
  data: FurnaceData;
  onClick?: (furnace: FurnaceData) => void;
}

export function FurnaceCard({ data, onClick }: FurnaceCardProps) {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    setIsBlinking(data.status === 'error');
  }, [data.status]);

  const statusText = { normal: '正常', warning: '预警', error: '告警' };
  const statusColor = { normal: '#00ff88', warning: '#f0b429', error: '#ff4444' };

  const statusClass = `status-${data.status}`;

  return (
    <div
      className={`furnace-card ${statusClass} ${isBlinking ? 'blink' : ''}`}
      style={{
        animation: isBlinking ? 'blink-animation 0.8s infinite' : 'none',
        cursor: 'pointer',
      }}
      onClick={() => onClick?.(data)}
    >
      <div className="furnace-header">
        <span className="furnace-name">{data.name}</span>
        <span className="furnace-status" style={{ color: statusColor[data.status] }}>
          {statusText[data.status]}
        </span>
      </div>
      <div className="furnace-metrics">
        <div className="metric">
          <span className="metric-label">温度</span>
          <span className="metric-value" style={{ color: data.temperature > 1400 ? '#ff4444' : '#00d4ff' }}>
            {data.temperature.toFixed(1)}°C
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">压力</span>
          <span className="metric-value">{data.pressure.toFixed(2)} MPa</span>
        </div>
      </div>
    </div>
  );
}
