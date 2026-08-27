import { useEffect, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { FurnaceData } from '../types';

interface DeviceDetailModalProps {
  device: FurnaceData;
  onClose: () => void;
  onChartClick: (device: FurnaceData, chartType: 'temp' | 'pressure') => void;
}

function generate24hData(base: number, variance: number, count: number = 144) {
  const now = Date.now();
  const data: [string, number][] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(now - i * 10 * 60 * 1000);
    const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const value = base + (Math.random() - 0.5) * variance * 2;
    data.push([timeStr, Math.round(value * 10) / 10]);
  }
  return data;
}

export function DeviceDetailModal({ device, onClose, onChartClick }: DeviceDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const tempData = useMemo(() => generate24hData(device.temperature, 30), [device.temperature]);
  const pressureData = useMemo(() => generate24hData(device.pressure, 0.3), [device.pressure]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const statusMap: Record<string, { label: string; color: string }> = {
    normal: { label: '正常', color: '#00ff88' },
    warning: { label: '预警', color: '#f0b429' },
    error: { label: '告警', color: '#ff4444' },
  };

  const runningHours = (8000 + device.id * 523) % 12000;
  const installDate = `2022-${String(device.id + 3).padStart(2, '0')}-15`;

  const makeChartOption = (
    data: [string, number][],
    color: string,
    label: string,
    unit: string,
    thresholds?: { warn: number; err: number },
  ) => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(10,22,40,0.9)',
      borderColor: color,
      textStyle: { color: '#c0d0e0', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0];
        return `${p.axisValue}<br/>${label}: <b>${p.value[1]}${unit}</b>`;
      },
    },
    grid: { top: 10, right: 15, bottom: 30, left: 50 },
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d[0]),
      axisLine: { lineStyle: { color: '#1a3a5a' } },
      axisLabel: { color: '#5577aa', fontSize: 10, interval: Math.floor(data.length / 6) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisLabel: { color: '#5577aa', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
    },
    series: [{
      type: 'line' as const,
      data: data.map(d => d[1]),
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear' as const,
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '40' },
            { offset: 1, color: color + '05' },
          ],
        },
      },
      markLine: thresholds ? {
        silent: true,
        lineStyle: { type: 'dashed' as const },
        data: [
          { yAxis: thresholds.warn, lineStyle: { color: '#f0b429' }, label: { formatter: `预警 ${thresholds.warn}`, color: '#f0b429', fontSize: 10 } },
          { yAxis: thresholds.err, lineStyle: { color: '#ff4444' }, label: { formatter: `告警 ${thresholds.err}`, color: '#ff4444', fontSize: 10 } },
        ],
      } : undefined,
    }],
  });

  const tempOption = makeChartOption(tempData, '#ff6b6b', '温度', '°C', { warn: 1380, err: 1400 });
  const pressureOption = makeChartOption(pressureData, '#00d4ff', '压力', ' MPa', { warn: 3.3, err: 3.5 });

  return (
    <div className="device-modal-overlay" onClick={onClose}>
      <div
        className="device-modal"
        ref={modalRef}
        onClick={e => e.stopPropagation()}
      >
        <div className="device-modal-header">
          <h3>{device.name} - 设备详情</h3>
          <button className="device-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="device-modal-body">
          <div className="device-params-row">
            <div className="device-param-card">
              <div className="param-icon temp">T</div>
              <div className="param-info">
                <span className="param-label">实时温度</span>
                <span className="param-value" style={{ color: device.temperature > 1400 ? '#ff4444' : '#00d4ff' }}>
                  {device.temperature.toFixed(1)}°C
                </span>
              </div>
            </div>
            <div className="device-param-card">
              <div className="param-icon pressure">P</div>
              <div className="param-info">
                <span className="param-label">实时压力</span>
                <span className="param-value">{device.pressure.toFixed(2)} MPa</span>
              </div>
            </div>
            <div className="device-param-card">
              <div className="param-icon status" style={{ borderColor: statusMap[device.status].color + '60', background: statusMap[device.status].color + '15' }}>
                <span style={{ color: statusMap[device.status].color, fontSize: 13, fontWeight: 600 }}>
                  {statusMap[device.status].label}
                </span>
              </div>
              <div className="param-info">
                <span className="param-label">设备状态</span>
                <span className="param-value" style={{ color: statusMap[device.status].color }}>
                  {statusMap[device.status].label}
                </span>
              </div>
            </div>
          </div>

          <div className="device-charts-row">
            <div className="device-chart-box" onClick={() => onChartClick(device, 'temp')}>
              <div className="chart-box-title">
                <span>24小时温度趋势</span>
                <span className="chart-click-hint">点击全屏</span>
              </div>
              <ReactECharts option={tempOption} style={{ height: 200, width: '100%' }} />
            </div>
            <div className="device-chart-box" onClick={() => onChartClick(device, 'pressure')}>
              <div className="chart-box-title">
                <span>24小时压力趋势</span>
                <span className="chart-click-hint">点击全屏</span>
              </div>
              <ReactECharts option={pressureOption} style={{ height: 200, width: '100%' }} />
            </div>
          </div>

          <div className="device-info-section">
            <div className="device-info-row">
              <span className="info-label">设备编号</span>
              <span className="info-value">FUR-{String(device.id).padStart(3, '0')}</span>
            </div>
            <div className="device-info-row">
              <span className="info-label">投运日期</span>
              <span className="info-value">{installDate}</span>
            </div>
            <div className="device-info-row">
              <span className="info-label">累计运行时长</span>
              <span className="info-value">{runningHours.toLocaleString()} 小时</span>
            </div>
          </div>
        </div>

        <div className="device-modal-footer">
          <button className="device-modal-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
