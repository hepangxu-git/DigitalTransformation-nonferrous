import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

interface TemperatureTrendChartProps {
  furnaceId: number;
  furnaceName: string;
  currentTemp: number;
}

function generateTemperatureData(baseTemp: number): { time: string; value: number }[] {
  const data: { time: string; value: number }[] = [];
  const now = new Date();

  for (let i = 60; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 1000);
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const fluctuation = (Math.random() - 0.5) * 40;
    data.push({
      time: `${hours}:${minutes}`,
      value: Math.round((baseTemp + fluctuation) * 10) / 10,
    });
  }

  return data;
}

export function TemperatureTrendChart({ furnaceId, furnaceName, currentTemp }: TemperatureTrendChartProps) {
  const chartData = useMemo(() => generateTemperatureData(currentTemp), [furnaceId, currentTemp]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: {
      top: 40,
      right: 16,
      bottom: 30,
      left: 50,
    },
    title: {
      text: `${furnaceName} - 温度趋势`,
      textStyle: {
        color: '#00d4ff',
        fontSize: 14,
        fontWeight: 600,
      },
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 22, 40, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: {
        color: '#e0e8f0',
        fontSize: 12,
      },
      formatter: (params: Array<{ axisValue: string; value: number }>) => {
        const item = params[0];
        return `时间: ${item.axisValue}<br/>温度: <b style="color:#00d4ff">${item.value}℃</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.time),
      axisLine: {
        lineStyle: { color: 'rgba(0, 212, 255, 0.3)' },
      },
      axisLabel: {
        color: '#6688aa',
        fontSize: 10,
        interval: Math.floor(chartData.length / 6),
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(value.min - 10),
      max: (value: { max: number }) => Math.ceil(value.max + 10),
      axisLine: { show: false },
      axisLabel: {
        color: '#6688aa',
        fontSize: 10,
        formatter: '{value}℃',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: '温度',
        type: 'line',
        data: chartData.map(d => d.value),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#00d4ff',
          width: 2,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 212, 255, 0.02)' },
            ],
          },
        },
      },
    ],
  }), [chartData, furnaceName]);

  return (
    <ReactECharts
      option={option}
      style={{ height: '220px', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
