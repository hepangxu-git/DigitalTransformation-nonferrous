import { useState, useEffect, useCallback, useRef } from 'react';
import type { FurnaceData, TemperaturePoint } from '../types';
import { createMockWebSocket, getTemperatureHistory } from '../hooks/useMockWebSocket';
import { FurnaceCard } from './FurnaceCard';
import { TemperatureChart } from './TemperatureChart';
import { DeviceDetailModal } from './DeviceDetailModal';
import { ChartFullscreenModal } from './ChartFullscreenModal';

interface AlertRecord {
  id: number;
  furnaceName: string;
  alertType: string;
  alertLevel: 'normal' | 'warning' | 'error';
  alertTime: string;
  status: string;
  currentValue: number;
  threshold: number;
}

export function Dashboard() {
  const [furnaces, setFurnaces] = useState<FurnaceData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [temperatureHistory, setTemperatureHistory] = useState<Map<number, TemperaturePoint[]>>(new Map());
  const [alertRecords, setAlertRecords] = useState<AlertRecord[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertRecord | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<FurnaceData | null>(null);
  const [showDeviceDetail, setShowDeviceDetail] = useState(false);
  const [fullscreenChart, setFullscreenChart] = useState<{ device: FurnaceData; chartType: 'temp' | 'pressure' } | null>(null);
  const processedAlertIds = useRef(new Set<number>());

  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const handleMessage = useCallback((data: FurnaceData[]) => {
    setFurnaces(data);
    setTemperatureHistory(new Map(getTemperatureHistory()));
    setIsConnected(true);

    const newAlerts: AlertRecord[] = data
      .filter(f => f.status !== 'normal')
      .map(f => ({
        id: f.id,
        furnaceName: f.name,
        alertType: f.status === 'error' ? '温度超限告警' : '温度偏高预警',
        alertLevel: f.status,
        alertTime: new Date(f.timestamp).toLocaleString('zh-CN'),
        status: processedAlertIds.current.has(f.id)
          ? '已处理'
          : f.status === 'error' ? '未处理' : '已确认',
        currentValue: f.temperature,
        threshold: f.status === 'error' ? 1400 : 1380,
      }));
    setAlertRecords(newAlerts);
  }, []);

  useEffect(() => {
    const ws = createMockWebSocket(handleMessage);
    ws.start();

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      ws.stop();
      clearInterval(timeInterval);
    };
  }, [handleMessage]);

  const warningCount = furnaces.filter(f => f.status === 'warning').length;
  const errorCount = furnaces.filter(f => f.status === 'error').length;
  const normalCount = furnaces.filter(f => f.status === 'normal').length;

  const handleAlertClick = (alert: AlertRecord) => {
    setSelectedAlert(alert);
    setShowDialog(true);
  };

  const handleConfirmProcess = async () => {
    if (!selectedAlert) return;

    try {
      const response = await fetch(`https://digital-transformation-nonferrous.vercel.app/api/alerts/${selectedAlert.id}/resolve`, {
        method: 'PUT',
      });
      const result = await response.json();

      if (result.code === 0) {
        processedAlertIds.current.add(selectedAlert.id);

        setAlertRecords(prev =>
          prev.map(a =>
            a.id === selectedAlert.id ? { ...a, status: '已处理' } : a
          )
        );

        setSelectedAlert(prev =>
          prev ? { ...prev, status: '已处理' } : null
        );

        displayToast('已确认处理，告警已关闭');

        setTimeout(() => {
          setShowDialog(false);
          setSelectedAlert(null);
        }, 800);
      } else {
        displayToast('处理失败: ' + (result.message || '未知错误'));
      }
    } catch {
      displayToast('处理失败，请重试');
    }
  };

  const handleDeviceClick = (furnace: FurnaceData) => {
    setSelectedDevice(furnace);
    setShowDeviceDetail(true);
  };

  const handleChartClick = (device: FurnaceData, chartType: 'temp' | 'pressure') => {
    setFullscreenChart({ device, chartType });
    setShowDeviceDetail(false);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-logo">W</div>
          <h1>铜矿熔炼车间监控系统</h1>
        </div>
        <div className="header-right">
          <div className="status-indicator">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            {isConnected ? '数据连接正常' : '连接中...'}
          </div>
          <div className="current-time">
            {currentTime.toLocaleString('zh-CN', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </div>
          <div className="user-info">
            <div className="user-avatar">管</div>
            <span>管理员</span>
          </div>
        </div>
      </header>

      <div className="dashboard-stats">
        <div className="stat-item normal">
          <div className="stat-icon">●</div>
          <span className="stat-value">{normalCount}</span>
          <span className="stat-label">正常运行</span>
        </div>
        <div className="stat-item warning">
          <div className="stat-icon">●</div>
          <span className="stat-value">{warningCount}</span>
          <span className="stat-label">温度偏高</span>
        </div>
        <div className="stat-item error">
          <div className="stat-icon">●</div>
          <span className="stat-value">{errorCount}</span>
          <span className="stat-label">温度过高</span>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="chart-section">
          <div className="section-title">温度趋势分析</div>
          <TemperatureChart history={temperatureHistory} />
        </div>
        <div className="furnaces-section">
          <div className="section-title">熔炼炉状态</div>
          <div className="furnaces-grid">
            {furnaces.map(furnace => (
              <FurnaceCard key={furnace.id} data={furnace} onClick={handleDeviceClick} />
            ))}
          </div>
        </div>

        <div className="alert-section">
          <div className="section-title">告警列表</div>
          <table className="alert-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>设备名称</th>
                <th>告警类型</th>
                <th>告警级别</th>
                <th>告警时间</th>
                <th>处理状态</th>
              </tr>
            </thead>
            <tbody>
              {alertRecords.length > 0 ? (
                alertRecords.map((alert, index) => (
                  <tr
                    key={`${alert.id}-${index}`}
                    className="alert-row"
                    onClick={() => handleAlertClick(alert)}
                  >
                    <td>{String(index + 1).padStart(2, '0')}</td>
                    <td>{alert.furnaceName}</td>
                    <td>{alert.alertType}</td>
                    <td className={`level-${alert.alertLevel}`}>
                      {alert.alertLevel === 'error' ? '严重' : '一般'}
                    </td>
                    <td>{alert.alertTime}</td>
                    <td>{alert.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#00ff88' }}>
                    当前无告警信息
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDialog && selectedAlert && (
        <div className="alert-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="alert-dialog" onClick={e => e.stopPropagation()}>
            <div className="alert-dialog-header">
              <h3>告警详情</h3>
              <button className="alert-dialog-close" onClick={() => setShowDialog(false)}>×</button>
            </div>
            <div className="alert-dialog-body">
              <div className="alert-detail-row">
                <span className="alert-detail-label">设备名称</span>
                <span className="alert-detail-value">{selectedAlert.furnaceName}</span>
              </div>
              <div className="alert-detail-row">
                <span className="alert-detail-label">告警类型</span>
                <span className="alert-detail-value">{selectedAlert.alertType}</span>
              </div>
              <div className="alert-detail-row">
                <span className="alert-detail-label">告警级别</span>
                <span className={`alert-detail-value level-${selectedAlert.alertLevel}`}>
                  {selectedAlert.alertLevel === 'error' ? '严重' : '一般'}
                </span>
              </div>
              <div className="alert-detail-row">
                <span className="alert-detail-label">发生时间</span>
                <span className="alert-detail-value">{selectedAlert.alertTime}</span>
              </div>
              <div className="alert-detail-row">
                <span className="alert-detail-label">当前温度</span>
                <span className="alert-detail-value">{selectedAlert.currentValue}℃</span>
              </div>
              <div className="alert-detail-row">
                <span className="alert-detail-label">告警阈值</span>
                <span className="alert-detail-value">{selectedAlert.threshold}℃</span>
              </div>
              <div className="alert-detail-row">
                <span className="alert-detail-label">处理状态</span>
                <span className={`alert-detail-value status-${selectedAlert.status === '已处理' ? 'processed' : 'unprocessed'}`}>
                  {selectedAlert.status}
                </span>
              </div>
            </div>
            <div className="alert-dialog-footer">
              <button
                className="alert-dialog-btn confirm"
                onClick={handleConfirmProcess}
                disabled={selectedAlert.status === '已处理'}
              >
                {selectedAlert.status === '已处理' ? '已处理' : '确认处理'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="toast-notification">
          <span className="toast-icon">✓</span>
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}

      {showDeviceDetail && selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setShowDeviceDetail(false)}
          onChartClick={handleChartClick}
        />
      )}

      {fullscreenChart && (
        <ChartFullscreenModal
          device={fullscreenChart.device}
          chartType={fullscreenChart.chartType}
          onClose={() => setFullscreenChart(null)}
        />
      )}
    </div>
  );
}
