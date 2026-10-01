/**
 * 构件：银河系盘（galaxy-disc）
 *
 * 低多边形 + 粒子点云表现的盘状星系。核心偏亮，旋臂向外渐暗。
 * 若 cfg.hotspot 有坐标，会在该处放一个发光标记球 + 朝向相机的光环。
 *
 * ⚠️ 占位模型：位置、密度、颜色均为示意，不对应任何真实天文数值。
 */
import * as THREE from 'three';
import { matteMaterial } from '../lib/matte.js';
import { createHotspotMarker } from '../lib/hotspot.js';

const ARMS = 2;
const COUNT = 7000;
const R_INNER = 1.2;
const R_OUTER = 7.0;

/** 高斯近似，用于给粒子加厚度和散射 */
function gauss(scale = 1) {
  return (Math.random() + Math.random() + Math.random() - 1.5) * scale;
}

export function buildGalaxyDisc(stage, cfg) {
  const group = new THREE.Group();
  const { palette } = stage;

  /* ---- 星系核 ---- */
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 2),
    matteMaterial(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.55 }),
  );
  group.add(core);

  /* ---- 粒子盘 ---- */
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const cInner = new THREE.Color(palette.accentSoft);
  const cOuter = new THREE.Color(palette.model[0]);
  const tmp = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const t = Math.pow(Math.random(), 0.65); // 靠近核心稍密
    const r = R_INNER + t * (R_OUTER - R_INNER);
    const arm = i % ARMS;
    const angle = t * Math.PI * 2.5 + (arm * Math.PI * 2) / ARMS + gauss(0.22);
    const spread = 0.22 * (0.5 + t);

    positions[i * 3] = Math.cos(angle) * r + gauss(spread);
    positions[i * 3 + 1] = gauss(0.28 * (1 - t * 0.55)); // 盘面薄，中心厚
    positions[i * 3 + 2] = Math.sin(angle) * r + gauss(spread);

    tmp.copy(cInner).lerp(cOuter, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.055,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(points);

  /* ---- 可点击光点（太阳系所在位置）---- */
  const marker = cfg.hotspot?.position ? createHotspotMarker(stage, cfg.hotspot.position) : null;
  if (marker) group.add(marker.group);

  return {
    group,
    update(t, dt, camera) {
      points.rotation.y += dt * 0.03;
      marker?.update(t, camera);
    },
  };
}
