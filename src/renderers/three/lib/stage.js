/**
 * 3D 舞台 —— 渲染器 / 场景 / 相机 / 光照 / 循环 / 自适应 / 销毁，集中在这里。
 * 各个场景只负责「往场景里放东西」和「每帧改点什么」，不碰 WebGL 细节。
 *
 * 用法：
 *   const stage = createStage(el, { fov: 45, position: [0,0,10] });
 *   stage.add(myGroup);
 *   const stop = stage.onFrame((t, dt) => {...});
 *   stage.flyTo([0,2,6], [0,0,0], 1200);
 *   stage.dispose();
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readPalette } from './palette.js';

/** 缓动：easeInOutCubic */
export function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function createStage(
  container,
  { fov = 45, near = 0.1, far = 400, position = [0, 0, 10], minDistance = 2, maxDistance = 80 } = {},
) {
  const palette = readPalette();

  /* ---------- 渲染器 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  /* ---------- 场景与相机 ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  camera.position.set(...position);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.7;
  controls.autoRotateSpeed = 0.55;

  /* ---------- 光照：半球光打底 + 一盏主光，保证低多边形有明暗面 ---------- */
  const hemi = new THREE.HemisphereLight(new THREE.Color(palette.text), new THREE.Color(palette.bg), 1.1);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(new THREE.Color(palette.text), 1.6);
  key.position.set(4, 7, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(new THREE.Color(palette.accent), 0.55);
  fill.position.set(-6, -3, -4);
  scene.add(fill);

  /* ---------- 自适应尺寸 ---------- */
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------- 帧循环 ---------- */
  const frameHooks = [];
  let raf = 0;
  let last = 0;
  let running = false;

  // 相机飞行状态（与 controls 互斥）
  let flight = null;

  function tick(now) {
    if (!running) return;
    const t = now / 1000;
    const dt = last ? Math.min(t - last, 0.1) : 0;
    last = t;

    if (flight) {
      const p = Math.min(1, (now - flight.start) / flight.duration);
      const k = easeInOutCubic(p);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (p >= 1) {
        const done = flight.onDone;
        flight = null;
        if (done) done();
      }
    }

    for (const hook of frameHooks) hook(t, dt, camera);
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* ---------- 对外的门面 ---------- */
  const stage = {
    THREE,
    renderer,
    scene,
    camera,
    controls,
    palette,

    add: (...objects) => {
      for (const o of objects) if (o) scene.add(o);
      return stage;
    },
    remove: (obj) => {
      scene.remove(obj);
      return stage;
    },

    /** 注册每帧回调，返回取消函数 */
    onFrame(fn) {
      frameHooks.push(fn);
      return () => {
        const i = frameHooks.indexOf(fn);
        if (i >= 0) frameHooks.splice(i, 1);
      };
    },

    /** 水平自动旋转开关 */
    setAutoRotate(on) {
      controls.autoRotate = !!on;
      return stage;
    },

    /**
     * 平滑飞向新机位。飞行期间禁用交互，结束后按需恢复。
     * @returns {Promise<void>}
     */
    flyTo(toPos, toTarget, durationMs = 1200) {
      const ms = Math.max(1, durationMs);
      controls.enabled = false;
      return new Promise((resolve) => {
        flight = {
          start: performance.now(),
          duration: ms,
          fromPos: camera.position.clone(),
          toPos: new THREE.Vector3(...toPos),
          fromTarget: controls.target.clone(),
          toTarget: new THREE.Vector3(...toTarget),
          onDone: () => {
            controls.enabled = true;
            resolve();
          },
        };
      });
    },

    /** 立即定位，不做动画 */
    snapTo(pos, target = [0, 0, 0]) {
      flight = null;
      camera.position.set(...pos);
      controls.target.set(...target);
      controls.update();
      return stage;
    },

    /** 世界坐标 → 容器内像素坐标。用于把 HTML 热区贴到 3D 物体上。 */
    projectToScreen(vec3) {
      const v = new THREE.Vector3(...vec3).project(camera);
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      return {
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        visible: v.z > -1 && v.z < 1,
      };
    },

    start,
    stop,

    dispose() {
      stop();
      ro.disconnect();
      flight = null;
      frameHooks.length = 0;
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) m.dispose();
      });
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };

  return stage;
}
