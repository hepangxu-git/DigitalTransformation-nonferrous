import { useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { FurnaceData } from '../types';

interface ChartFullscreenModalProps {
  device: FurnaceData;
  chartType: 'temp' | 'pressure';
  onClose: () => void;
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

export function ChartFullscreenModal({ device, chartType, onClose }: ChartFullscreenModalProps) {
  const isTemp = chartType === 'temp';
  const base = isTemp ? device.temperature : device.pressure;
  const variance = isTemp ? 30 : 0.3;
  const data = useMemo(() => generate24hData(base, variance), [base, variance]);
  const values = data.map(d => d[1]);

  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const avgVal = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const latestVal = values[values.length - 1];

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    return () => clearTimeout(timer);
  }, []);

  const color = isTemp ? '#ff6b6b' : '#00d4ff';
  const unit = isTemp ? '°C' : ' MPa';
  const label = isTemp ? '温度' : '压力';
  const thresholds = isTemp ? { warn: 1380, err: 1400 } : { warn: 3.3, err: 3.5 };

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(10,22,40,0.95)',
      borderColor: color,
      textStyle: { color: '#c0d0e0', fontSize: 13 },
      formatter: (params: any) => {
        const p = params[0];
        return `${p.axisValue}<br/>${label}: <b style="color:${color}">${p.value[1]}${unit}</b>`;
      },
    },
    grid: { top: 30, right: 30, bottom: 80, left: 60 },
    dataZoom: [
      {
        type: 'slider' as const,
        start: 0,
        end: 100,
        height: 25,
        bottom: 15,
        borderColor: 'rgba(0,212,255,0.2)',
        backgroundColor: 'rgba(10,22,40,0.6)',
        fillerColor: 'rgba(0,212,255,0.1)',
        handleStyle: { color: color, borderColor: color },
        textStyle: { color: '#5577aa', fontSize: 11 },
        dataBackground: {
          lineStyle: { color: color + '60' },
          areaStyle: { color: color + '20' },
        },
      },
      {
        type: 'inside' as const,
        start: 0,
        end: 100,
      },
    ],
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d[0]),
      axisLine: { lineStyle: { color: '#1a3a5a' } },
      axisLabel: { color: '#5577aa', fontSize: 11, rotate: 30 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisLabel: { color: '#5577aa', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
    },
    series: [{
      type: 'line' as const,
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 3,
      lineStyle: { color, width: 2.5 },
      itemStyle: { color },
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
      markLine: {
        silent: true,
        lineStyle: { type: 'dashed' as const },
        data: [
          { yAxis: thresholds.warn, lineStyle: { color: '#f0b429' }, label: { formatter: `预警 ${thresholds.warn}${unit}`, color: '#f0b429', fontSize: 11 } },
          { yAxis: thresholds.err, lineStyle: { color: '#ff4444' }, label: { formatter: `告警 ${thresholds.err}${unit}`, color: '#ff4444', fontSize: 11 } },
        ],
      },
    }],
  };

  return (
    <div className="fullscreen-modal-overlay" onClick={onClose}>
      <div className="fullscreen-modal" onClick={e => e.stopPropagation()}>
        <div className="fullscreen-modal-header">
          <h3>{device.name} - {label}趋势图（全屏）</h3>
          <button className="fullscreen-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="fullscreen-modal-chart">
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>

        <div className="fullscreen-modal-stats">
          <div className="stat-block">
            <span className="stat-block-label">最高{label}</span>
            <span className="stat-block-value" style={{ color: '#ff4444' }}>{maxVal}{unit}</span>
          </div>
          <div className="stat-block">
            <span className="stat-block-label">最低{label}</span>
            <span className="stat-block-value" style={{ color: '#00ff88' }}>{minVal}{unit}</span>
          </div>
          <div className="stat-block">
            <span className="stat-block-label">平均{label}</span>
            <span className="stat-block-value" style={{ color: '#00d4ff' }}>{avgVal}{unit}</span>
          </div>
          <div className="stat-block">
            <span className="stat-block-label">最新{label}</span>
            <span className="stat-block-value" style={{ color: latestVal > thresholds.warn ? '#f0b429' : '#00d4ff' }}>
              {latestVal}{unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
