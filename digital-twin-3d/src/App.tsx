import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TemperatureTrendChart } from './components/TemperatureTrendChart';
import './App.css';

/* ========== 类型定义 ========== */

/** 熔炉状态 */
interface FurnaceStatus {
  id: number;
  name: string;
  status: 'normal' | 'warning' | 'error';
  temperature: number;
  pressure: number;
  isAlert: boolean;
}

/** 选中熔炉（详情面板） */
interface SelectedFurnace {
  id: number;
  name: string;
  status: 'normal' | 'warning' | 'error';
  temperature: number;
  pressure: number;
  x: number;
  y: number;
}

/** 趋势图面板 */
interface TrendPanel {
  furnaceId: number;
  furnaceName: string;
  temperature: number;
  x: number;
  y: number;
}

/** 告警事件 */
interface AlarmEvent {
  id: number;
  furnaceId: number;
  furnaceName: string;
  type: string;
  level: 'warning' | 'error';
  time: string;
  details: string;
  handled: boolean;
}

/** 跨页面通信事件 */
interface CrossPageEvent {
  type: 'furnace-click' | 'alarm-update' | 'furnace-focus';
  furnaceId: number;
  timestamp: number;
}

/* ========== 常量 ========== */

const OVERVIEW_CAMERA = new THREE.Vector3(12, 10, 12);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const FOCUS_DISTANCE = 7;
const FOCUS_HEIGHT = 4;
const CAMERA_ANIM_DURATION = 1.0;
const FLASH_INTERVAL = 500;
const TEMP_THRESHOLD = 1380;
const PRESSURE_THRESHOLD = 3.5;
const STORAGE_KEY = 'digital-twin-events';

/* ========== 主组件 ========== */

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);
  const [selectedFurnace, setSelectedFurnace] = useState<SelectedFurnace | null>(null);
  const [focusedName, setFocusedName] = useState<string | null>(null);
  const [trendPanel, setTrendPanel] = useState<TrendPanel | null>(null);
  const [trendPanelPos, setTrendPanelPos] = useState({ x: 0, y: 0 });
  const [showFaultMenu, setShowFaultMenu] = useState(false);
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const [showAlarmList, setShowAlarmList] = useState(false);

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const furnaceGroupsRef = useRef<THREE.Group[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const cameraAnimRef = useRef({
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
    duration: CAMERA_ANIM_DURATION,
  });

  const focusedFurnaceRef = useRef<THREE.Group | null>(null);
  const glowLightsRef = useRef<Map<THREE.Group, THREE.PointLight>>(new Map());
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());
  const indicatorsRef = useRef<THREE.Mesh[]>([]);
  const flashTimersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const flashStateRef = useRef<Map<number, boolean>>(new Map());

  const [furnaceStatuses, setFurnaceStatuses] = useState<FurnaceStatus[]>([
    { id: 1, name: '1# 熔炼炉', status: 'normal', temperature: 1280, pressure: 2.8, isAlert: false },
    { id: 2, name: '2# 熔炼炉', status: 'normal', temperature: 1260, pressure: 2.6, isAlert: false },
    { id: 3, name: '3# 熔炼炉', status: 'normal', temperature: 1290, pressure: 2.9, isAlert: false },
  ]);

  /* ========== 跨页面通信：广播事件 ========== */

  const broadcastEvent = useCallback((event: CrossPageEvent) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      existing.push(event);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-50)));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    } catch { /* ignore */ }
  }, []);

  /* ========== 跨页面通信：监听事件 ========== */

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const events: CrossPageEvent[] = JSON.parse(e.newValue || '[]');
        const latest = events[events.length - 1];
        if (!latest) return;

        if (latest.type === 'furnace-focus' && latest.furnaceId > 0) {
          (window as any).__twinFocus?.(latest.furnaceId);
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /* ========== 主 Three.js 场景 ========== */

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.copy(OVERVIEW_CAMERA);
    camera.lookAt(OVERVIEW_TARGET);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controlsRef.current = controls;

    /* --- 灯光 --- */
    scene.add(new THREE.AmbientLight(0x404060, 0.6));

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const pointLight1 = new THREE.PointLight(0x00d4ff, 0.5, 20);
    pointLight1.position.set(-5, 5, -5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6b6b, 0.3, 15);
    pointLight2.position.set(5, 3, 5);
    scene.add(pointLight2);

    /* --- 地面 + 网格 --- */
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.8, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(20, 20, 0x00d4ff, 0x0a2040);
    grid.position.y = 0.01;
    scene.add(grid);

    /* --- 创建熔炉 --- */
    const furnaceGroup = new THREE.Group();
    const indicators: THREE.Mesh[] = [];
    indicatorsRef.current = indicators;

    const createFurnace = (x: number, z: number, index: number) => {
      const group = new THREE.Group();

      // 炉体
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 3, 2),
        new THREE.MeshStandardMaterial({ color: 0x2a3a50, roughness: 0.6, metalness: 0.4 })
      );
      body.position.y = 1.5;
      body.castShadow = true;
      group.add(body);

      // 炉顶
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.2, 1, 16),
        new THREE.MeshStandardMaterial({ color: 0x3a4a60, roughness: 0.5, metalness: 0.5 })
      );
      top.position.y = 3.5;
      top.castShadow = true;
      group.add(top);

      // 烟囱
      const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a5a70, roughness: 0.4, metalness: 0.6 })
      );
      chimney.position.y = 4.75;
      chimney.castShadow = true;
      group.add(chimney);

      // 指示灯
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.5,
      });
      const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), indicatorMat);
      indicator.position.y = 5.7;
      indicator.userData = { index };
      group.add(indicator);
      indicators.push(indicator);

      // 指示灯光
      const glow = new THREE.PointLight(0x00ff88, 0.5, 3);
      glow.position.y = 5.7;
      group.add(glow);

      group.position.set(x, 0, z);
      return group;
    };

    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      furnaceGroup.add(createFurnace(Math.cos(angle) * 5, Math.sin(angle) * 5, i));
    }
    furnaceGroupsRef.current = furnaceGroup.children as THREE.Group[];
    scene.add(furnaceGroup);

    /* --- 墙壁 --- */
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a40, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.3,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), wallMat);
    backWall.position.set(0, 3, -10);
    scene.add(backWall);
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), wallMat);
    leftWall.position.set(-10, 3, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    /* --- Raycaster --- */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getClickedFurnace = (event: MouseEvent): THREE.Group | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const meshes: THREE.Object3D[] = [];
      furnaceGroupsRef.current.forEach(g => g.traverse(c => { if (c instanceof THREE.Mesh) meshes.push(c); }));
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) return null;

      let obj: THREE.Object3D | null = hits[0].object;
      while (obj) {
        if (obj instanceof THREE.Group && furnaceGroupsRef.current.includes(obj)) return obj;
        obj = obj.parent;
      }
      return null;
    };

    /* --- 功能1: 双击聚焦 --- */
    const handleDoubleClick = (event: MouseEvent) => {
      const group = getClickedFurnace(event);
      if (group) {
        focusOnFurnace(group);
      } else {
        resetToOverview();
      }
    };
    containerRef.current.addEventListener('dblclick', handleDoubleClick);

    /* --- 功能3: 单击同步 --- */
    const handleClick = (event: MouseEvent) => {
      const group = getClickedFurnace(event);
      if (group) {
        const index = furnaceGroupsRef.current.indexOf(group);
        if (index !== -1) {
          broadcastEvent({
            type: 'furnace-click',
            furnaceId: index + 1,
            timestamp: Date.now(),
          });

          const status = furnaceStatuses[index];
          const worldPos = new THREE.Vector3();
          group.getWorldPosition(worldPos);
          const screenPos = worldPos.clone().project(camera);
          const rect = containerRef.current!.getBoundingClientRect();
          const x = (screenPos.x * 0.5 + 0.5) * rect.width;
          const y = (-screenPos.y * 0.5 + 0.5) * rect.height;

          setSelectedFurnace({
            id: status.id, name: status.name, status: status.status,
            temperature: status.temperature, pressure: status.pressure,
            x: Math.min(Math.max(x, 120), rect.width - 120),
            y: Math.min(Math.max(y, 100), rect.height - 100),
          });
          setTrendPanel({
            furnaceId: status.id, furnaceName: status.name,
            temperature: status.temperature,
            x: window.innerWidth - 380, y: 80,
          });
        }
      } else {
        setSelectedFurnace(null);
        setTrendPanel(null);
      }
    };
    containerRef.current.addEventListener('click', handleClick);

    /* --- ESC 键复位 --- */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetToOverview();
    };
    window.addEventListener('keydown', handleKeyDown);

    /* --- 功能1: 聚焦/复位函数（挂到 window 供外部调用） --- */
    (window as any).__twinFocus = (furnaceId: number) => {
      const group = furnaceGroupsRef.current[furnaceId - 1];
      if (group) focusOnFurnace(group);
    };
    (window as any).__twinReset = () => resetToOverview();

    function focusOnFurnace(group: THREE.Group) {
      const worldPos = new THREE.Vector3();
      group.getWorldPosition(worldPos);
      const dir = worldPos.clone().normalize();
      const camPos = worldPos.clone().add(dir.multiplyScalar(FOCUS_DISTANCE)).add(new THREE.Vector3(0, FOCUS_HEIGHT, 0));

      highlightFurnace(group);
      animateCameraTo(camPos, worldPos);

      const index = furnaceGroupsRef.current.indexOf(group);
      if (index !== -1) {
        setFocusedName(furnaceStatuses[index]?.name || null);
        broadcastEvent({ type: 'furnace-focus', furnaceId: index + 1, timestamp: Date.now() });
      }
    }

    function resetToOverview() {
      animateCameraTo(OVERVIEW_CAMERA, OVERVIEW_TARGET);
      clearHighlight();
      setSelectedFurnace(null);
      setTrendPanel(null);
      setFocusedName(null);
    }

    function highlightFurnace(group: THREE.Group) {
      if (focusedFurnaceRef.current === group) return;
      clearHighlight();
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          originalMaterialsRef.current.set(child, child.material);
          const mat = (child.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color(0x00d4ff);
          mat.emissiveIntensity = 0.3;
          child.material = mat;
        }
      });
      const glow = new THREE.PointLight(0x00d4ff, 1.5, 6);
      glow.position.y = 3;
      group.add(glow);
      glowLightsRef.current.set(group, glow);
      focusedFurnaceRef.current = group;
    }

    function clearHighlight() {
      if (!focusedFurnaceRef.current) return;
      const group = focusedFurnaceRef.current;
      group.traverse(child => {
        if (child instanceof THREE.Mesh && originalMaterialsRef.current.has(child)) {
          child.material = originalMaterialsRef.current.get(child)!;
        }
      });
      const glow = glowLightsRef.current.get(group);
      if (glow) { group.remove(glow); glow.dispose(); glowLightsRef.current.delete(group); }
      originalMaterialsRef.current.clear();
      focusedFurnaceRef.current = null;
    }

    function animateCameraTo(targetPos: THREE.Vector3, lookAt: THREE.Vector3) {
      const anim = cameraAnimRef.current;
      anim.active = true;
      anim.startPos.copy(camera.position);
      anim.endPos.copy(targetPos);
      anim.startTarget.copy(controls.target);
      anim.endTarget.copy(lookAt);
      anim.progress = 0;
    }

    /* --- 功能2: 告警闪烁逻辑 --- */
    const startFlash = (furnaceIndex: number) => {
      if (flashTimersRef.current.has(furnaceIndex)) return;
      flashStateRef.current.set(furnaceIndex, false);

      const timer = setInterval(() => {
        const indicator = indicators[furnaceIndex];
        if (!indicator) return;
        const mat = indicator.material as THREE.MeshStandardMaterial;
        const light = indicator.parent?.children.find(
          c => c instanceof THREE.PointLight
        ) as THREE.PointLight | undefined;

        const isOn = flashStateRef.current.get(furnaceIndex) || false;
        if (isOn) {
          mat.color.setHex(0xff4444);
          mat.emissive.setHex(0xff4444);
          mat.emissiveIntensity = 1.0;
          if (light) { light.color.setHex(0xff4444); light.intensity = 2.0; }
        } else {
          mat.color.setHex(0x661111);
          mat.emissive.setHex(0x661111);
          mat.emissiveIntensity = 0.2;
          if (light) { light.color.setHex(0x661111); light.intensity = 0.5; }
        }
        flashStateRef.current.set(furnaceIndex, !isOn);
      }, FLASH_INTERVAL / 2);

      flashTimersRef.current.set(furnaceIndex, timer);
    };

    /* --- 定时刷新数据 --- */
    let frameCount = 0;
    let lastTime = performance.now();

    const updateData = () => {
      const statuses: FurnaceStatus[] = indicators.map((indicator, index) => {
        const isNormal = Math.random() > 0.2;
        const mat = indicator.material as THREE.MeshStandardMaterial;
        const light = indicator.parent?.children.find(
          c => c instanceof THREE.PointLight
        ) as THREE.PointLight | undefined;

        const temp = Math.round((1250 + Math.random() * 150) * 10) / 10;
        const pressure = Math.round((2.5 + Math.random() * 1.5) * 100) / 100;
        const isAlert = temp > TEMP_THRESHOLD || pressure > PRESSURE_THRESHOLD;

        if (isNormal && !isAlert) {
          if (!flashTimersRef.current.has(index)) {
            mat.color.setHex(0x00ff88);
            mat.emissive.setHex(0x00ff88);
            mat.emissiveIntensity = 0.5;
            if (light) { light.color.setHex(0x00ff88); light.intensity = 0.5; }
          }
          return { id: index + 1, name: `${index + 1}# 熔炼炉`, status: 'normal' as const, temperature: temp, pressure, isAlert: false };
        } else {
          if (isAlert) startFlash(index);
          return { id: index + 1, name: `${index + 1}# 熔炼炉`, status: 'error' as const, temperature: temp, pressure, isAlert };
        }
      });

      setFurnaceStatuses(statuses);

      // 同步趋势面板
      setTrendPanel(prev => {
        if (!prev) return null;
        const u = statuses.find(s => s.id === prev.furnaceId);
        return u ? { ...prev, temperature: u.temperature } : prev;
      });

      // 功能2: 生成告警事件
      const newAlarms: AlarmEvent[] = statuses
        .filter(s => s.isAlert)
        .map(s => ({
          id: Date.now() + s.id,
          furnaceId: s.id,
          furnaceName: s.name,
          type: s.temperature > TEMP_THRESHOLD ? '温度超限告警' : '压力异常告警',
          level: 'error' as const,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          details: s.temperature > TEMP_THRESHOLD
            ? `温度 ${s.temperature}℃ 超过阈值 ${TEMP_THRESHOLD}℃`
            : `压力 ${s.pressure}MPa 超过阈值 ${PRESSURE_THRESHOLD}MPa`,
          handled: false,
        }));

      setAlarmEvents(prev => {
        const unhandled = prev.filter(a => !a.handled);
        return [...newAlarms, ...unhandled].slice(0, 10);
      });
    };

    const intervalId = setInterval(updateData, 3000);

    /* --- 动画循环 --- */
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      const anim = cameraAnimRef.current;
      if (anim.active) {
        anim.progress += 0.016 / anim.duration;
        if (anim.progress >= 1) { anim.progress = 1; anim.active = false; }
        const t = 1 - Math.pow(1 - anim.progress, 3);
        camera.position.lerpVectors(anim.startPos, anim.endPos, t);
        controls.target.lerpVectors(anim.startTarget, anim.endTarget, t);
        controls.update();
      }

      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) { setFps(frameCount); frameCount = 0; lastTime = now; }
      renderer.render(scene, camera);
    };
    animate();

    /* --- 窗口缩放 --- */
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    /* --- 清理 --- */
    return () => {
      clearInterval(intervalId);
      flashTimersRef.current.forEach(t => clearInterval(t));
      flashTimersRef.current.clear();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleTrendDragMove);
      window.removeEventListener('mouseup', handleTrendDragEnd);
      containerRef.current?.removeEventListener('click', handleClick);
      containerRef.current?.removeEventListener('dblclick', handleDoubleClick);
      clearHighlight();
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      controls.dispose();
      delete (window as any).__twinFocus;
      delete (window as any).__twinReset;
    };
  }, [furnaceStatuses, broadcastEvent]);

  /* ========== 拖拽趋势面板 ========== */

  const handleTrendDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - trendPanelPos.x, y: e.clientY - trendPanelPos.y };
  }, [trendPanelPos]);

  const handleTrendDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    setTrendPanelPos({
      x: Math.max(0, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - 360)),
      y: Math.max(0, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - 320)),
    });
  }, []);

  const handleTrendDragEnd = useCallback(() => { isDraggingRef.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleTrendDragMove);
    window.addEventListener('mouseup', handleTrendDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleTrendDragMove);
      window.removeEventListener('mouseup', handleTrendDragEnd);
    };
  }, [handleTrendDragMove, handleTrendDragEnd]);

  /* ========== 模拟故障 ========== */

  const simulateFault = useCallback((faultType: string) => {
    const map: Record<string, { index: number; type: string; details: string }> = {
      'overtemp-1': { index: 0, type: '温度超限告警', details: '1# 熔炼炉温度超过安全阈值 1400℃' },
      'pressure-2': { index: 1, type: '压力异常告警', details: '2# 熔炼炉炉内压力异常波动' },
      'shutdown-3': { index: 2, type: '设备停机告警', details: '3# 熔炼炉意外停机' },
    };
    const cfg = map[faultType];
    if (!cfg) return;

    const indicators = indicatorsRef.current;
    if (!indicators[cfg.index]) return;

    const mat = indicators[cfg.index].material as THREE.MeshStandardMaterial;
    mat.color.setHex(0xff4444);
    mat.emissive.setHex(0xff4444);
    const light = indicators[cfg.index].parent?.children.find(
      c => c instanceof THREE.PointLight
    ) as THREE.PointLight | undefined;
    if (light) light.color.setHex(0xff4444);

    startFlashInternal(cfg.index);

    const now = new Date();
    const alarm: AlarmEvent = {
      id: Date.now(), furnaceId: cfg.index + 1, furnaceName: `${cfg.index + 1}# 熔炼炉`,
      type: cfg.type, level: 'error',
      time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      details: cfg.details, handled: false,
    };
    setAlarmEvents(prev => [alarm, ...prev].slice(0, 10));
    setShowAlarmList(true);
    setFurnaceStatuses(prev => prev.map((f, i) => i === cfg.index ? { ...f, status: 'error', isAlert: true } : f));
    setShowFaultMenu(false);

    broadcastEvent({ type: 'alarm-update', furnaceId: cfg.index + 1, timestamp: Date.now() });

    function startFlashInternal(idx: number) {
      if (flashTimersRef.current.has(idx)) return;
      flashStateRef.current.set(idx, false);
      const timer = setInterval(() => {
        const ind = indicators[idx];
        if (!ind) return;
        const m = ind.material as THREE.MeshStandardMaterial;
        const l = ind.parent?.children.find(c => c instanceof THREE.PointLight) as THREE.PointLight | undefined;
        const on = flashStateRef.current.get(idx) || false;
        m.color.setHex(on ? 0xff4444 : 0x661111);
        m.emissive.setHex(on ? 0xff4444 : 0x661111);
        m.emissiveIntensity = on ? 1.0 : 0.2;
        if (l) { l.color.setHex(on ? 0xff4444 : 0x661111); l.intensity = on ? 2.0 : 0.5; }
        flashStateRef.current.set(idx, !on);
      }, FLASH_INTERVAL / 2);
      flashTimersRef.current.set(idx, timer);
    }
  }, [broadcastEvent]);

  /* ========== 告警列表：点击定位 ========== */

  const handleAlarmClick = useCallback((alarm: AlarmEvent) => {
    (window as any).__twinFocus?.(alarm.furnaceId);
  }, []);

  /* ========== 告警处理 ========== */

  const handleAlarmProcess = useCallback((alarmId: number) => {
    setAlarmEvents(prev => prev.map(a => a.id === alarmId ? { ...a, handled: true } : a));
  }, []);

  /* ========== 渲染 ========== */

  const statusColor = { normal: '#00ff88', warning: '#f0b429', error: '#ff4444' };
  const statusText = { normal: '正常', warning: '预警', error: '告警' };

  return (
    <div className="app">
      <div ref={containerRef} className="three-container" />

      {/* FPS */}
      <div className="fps-display">
        <span className="fps-label">FPS</span>
        <span className="fps-value">{fps}</span>
      </div>

      {/* 功能1: 聚焦设备名称 */}
      {focusedName && (
        <div className="focus-label">
          <span className="focus-label-icon">📍</span>
          当前查看：{focusedName}
          <button className="focus-label-reset" onClick={() => (window as any).__twinReset?.()}>
            返回全景
          </button>
        </div>
      )}

      {/* 模拟故障 */}
      <div className="fault-simulate-container">
        <button className="fault-simulate-btn" onClick={() => setShowFaultMenu(!showFaultMenu)}>
          <span className="fault-btn-icon">⚠</span>
          模拟故障
          <span className={`fault-btn-arrow ${showFaultMenu ? 'open' : ''}`}>▾</span>
        </button>
        {showFaultMenu && (
          <div className="fault-menu">
            <div className="fault-menu-item" onClick={() => simulateFault('overtemp-1')}>
              <span className="fault-item-icon">🌡</span>
              <div className="fault-item-info">
                <span className="fault-item-title">1# 熔炉超温</span>
                <span className="fault-item-desc">温度超过 1400℃ 安全阈值</span>
              </div>
            </div>
            <div className="fault-menu-item" onClick={() => simulateFault('pressure-2')}>
              <span className="fault-item-icon">🔴</span>
              <div className="fault-item-info">
                <span className="fault-item-title">2# 熔炉压力异常</span>
                <span className="fault-item-desc">炉内压力异常波动</span>
              </div>
            </div>
            <div className="fault-menu-item" onClick={() => simulateFault('shutdown-3')}>
              <span className="fault-item-icon">⬛</span>
              <div className="fault-item-info">
                <span className="fault-item-title">3# 熔炉停机</span>
                <span className="fault-item-desc">设备意外停机</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 功能2: 告警列表 */}
      {alarmEvents.length > 0 && (
        <div className={`alarm-list-panel ${showAlarmList ? 'show' : ''}`}>
          <div className="alarm-panel-header">
            <span className="alarm-panel-title">
              <span className="alarm-title-icon">🚨</span>
              告警列表
              <span className="alarm-count">{alarmEvents.filter(a => !a.handled).length}</span>
            </span>
            <button className="alarm-panel-close" onClick={() => setShowAlarmList(false)}>×</button>
          </div>
          <div className="alarm-panel-body">
            {alarmEvents.map(alarm => (
              <div
                key={alarm.id}
                className={`alarm-item alarm-${alarm.level} ${alarm.handled ? 'handled' : ''}`}
                onClick={() => !alarm.handled && handleAlarmClick(alarm)}
              >
                <div className="alarm-item-header">
                  <span className="alarm-furnace">{alarm.furnaceName}</span>
                  <span className="alarm-time">{alarm.time}</span>
                </div>
                <div className="alarm-item-type">{alarm.type}</div>
                <div className="alarm-item-details">{alarm.details}</div>
                <div className="alarm-item-actions">
                  {alarm.handled ? (
                    <span className="alarm-handled-badge">✓ 已处理</span>
                  ) : (
                    <button
                      className="alarm-process-btn"
                      onClick={(e) => { e.stopPropagation(); handleAlarmProcess(alarm.id); }}
                    >
                      确认处理
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 设备状态面板 */}
      <div className="info-panel">
        <h2>数字孪生 - 车间监控</h2>
        <div className="furnace-list">
          {furnaceStatuses.map(f => (
            <div key={f.id} className="furnace-item">
              <span className="status-dot" style={{ backgroundColor: statusColor[f.status] }} />
              <span className="furnace-name">{f.name}</span>
              <span className="furnace-status" style={{ color: statusColor[f.status] }}>
                {statusText[f.status]}
              </span>
            </div>
          ))}
        </div>
        <p className="hint">左键旋转 | 右键平移 | 滚轮缩放 | 双击聚焦 | ESC 复位</p>
      </div>

      {/* 设备详情面板 */}
      {selectedFurnace && (
        <div className="furnace-detail-panel" style={{ left: selectedFurnace.x, top: selectedFurnace.y }} onClick={e => e.stopPropagation()}>
          <div className="detail-header">
            <span className="detail-status-dot" style={{ backgroundColor: statusColor[selectedFurnace.status] }} />
            <span className="detail-name">{selectedFurnace.name}</span>
          </div>
          <div className="detail-body">
            <div className="detail-row">
              <span className="detail-label">运行状态</span>
              <span className="detail-value" style={{ color: statusColor[selectedFurnace.status] }}>{statusText[selectedFurnace.status]}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">实时温度</span>
              <span className="detail-value">{selectedFurnace.temperature}℃</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">炉内压力</span>
              <span className="detail-value">{selectedFurnace.pressure} MPa</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">设备编号</span>
              <span className="detail-value">FRN-{String(selectedFurnace.id).padStart(3, '0')}</span>
            </div>
          </div>
          <div className="detail-arrow" />
        </div>
      )}

      {/* 趋势图面板 */}
      {trendPanel && (
        <div className="trend-panel" style={{ left: trendPanelPos.x, top: trendPanelPos.y }}>
          <div className="trend-panel-header" onMouseDown={handleTrendDragStart}>
            <span className="trend-panel-title">实时温度趋势</span>
            <button className="trend-panel-close" onClick={() => { setTrendPanel(null); setSelectedFurnace(null); }}>×</button>
          </div>
          <div className="trend-panel-body">
            <TemperatureTrendChart furnaceId={trendPanel.furnaceId} furnaceName={trendPanel.furnaceName} currentTemp={trendPanel.temperature} />
            <div className="trend-panel-info">
              <div className="trend-info-item">
                <span className="trend-info-label">当前温度</span>
                <span className="trend-info-value">{trendPanel.temperature}℃</span>
              </div>
              <div className="trend-info-item">
                <span className="trend-info-label">更新频率</span>
                <span className="trend-info-value">3秒/次</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
