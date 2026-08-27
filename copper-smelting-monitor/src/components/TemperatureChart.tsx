import ReactECharts from 'echarts-for-react';
import type { TemperaturePoint } from '../types';

interface TemperatureChartProps {
  history: Map<number, TemperaturePoint[]>;
}

const COLORS = ['#00d4ff', '#f0b429', '#00ff88', '#ff6b6b', '#a78bfa'];

export function TemperatureChart({ history }: TemperatureChartProps) {
  const series: any[] = [];
  const legendData: string[] = [];
  let xAxisData: string[] = [];

  history.forEach((points, furnaceId) => {
    if (points.length > 0 && furnaceId === 1) {
      xAxisData = points.map(p => p.time);
    }
    series.push({
      name: `${furnaceId}# 熔炼炉`,
      type: 'line',
      smooth: true,
      lineStyle: { width: 2 },
      symbol: 'none',
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: `${COLORS[(furnaceId - 1) % COLORS.length]}40` },
            { offset: 1, color: `${COLORS[(furnaceId - 1) % COLORS.length]}05` },
          ],
        },
      },
      data: points.map(p => p.temperature.toFixed(1)),
      itemStyle: { color: COLORS[(furnaceId - 1) % COLORS.length] },
    });
    legendData.push(`${furnaceId}# 熔炼炉`);
  });

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: '24小时温度趋势',
      left: 'center',
      top: 5,
      textStyle: { color: '#00d4ff', fontSize: 16, fontFamily: 'Microsoft YaHei, sans-serif' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 22, 40, 0.95)',
      borderColor: '#00d4ff',
      textStyle: { color: '#e0e8f0', fontFamily: 'Microsoft YaHei, sans-serif' },
    },
    legend: {
      data: legendData,
      bottom: 5,
      textStyle: { color: '#6688aa', fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 15,
    },
    grid: { left: 55, right: 20, top: 45, bottom: 75 },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: { color: '#5577aa', fontFamily: 'Consolas, monospace', rotate: 45, fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisTick: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
    },
    yAxis: {
      type: 'value',
      min: 1200,
      max: 1500,
      name: '温度 (°C)',
      nameTextStyle: { color: '#5577aa', fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 11 },
      axisLabel: { color: '#5577aa', fontFamily: 'Consolas, monospace', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.1)', type: 'dashed' } },
    },
    series,
  };

  return (
    <div className="chart-container">
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
