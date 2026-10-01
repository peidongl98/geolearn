/**
 * 构件：太阳系（solar-system）
 *
 * 中心恒星 + 若干行星 + 轨道圈（示意）。地球的位置直接取 cfg.hotspot.position，
 * 保证「光点标记」与「地球本体」永远重合 —— 改 JSON 就够，不用动代码。
 *
 * ⚠️ 占位模型：行星数量、间距、大小均为示意，不对应真实天文数值。
 */
import * as THREE from 'three';
import { matteMaterial } from '../lib/matte.js';
import { createHotspotMarker } from '../lib/hotspot.js';
import { createStarfield } from '../lib/starfield.js';

/** 其余行星的相对位置（地球由配置给出） */
const PLANET_SLOTS = [
  { r: 1.75, angle: 0.0 },
  { r: 2.35, angle: Math.PI * 0.42 },
  { r: 4.2, angle: Math.PI * 1.25 },
  { r: 5.1, angle: Math.PI * 0.72 },
];

function orbitRing(radius, color) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.008, 3, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

export function buildSolarSystem(stage, cfg) {
  const group = new THREE.Group();
  const { palette } = stage;

  // 背景星点
  group.add(createStarfield(stage, { count: 320, radius: 34, size: 0.08 }));

  /* ---- 中心恒星 ---- */
  const sun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.66, 2),
    matteMaterial(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.9 }),
  );
  group.add(sun);

  /* ---- 地球：位置以配置为准 ---- */
  const earthPos = cfg.hotspot?.position ?? [3.1, 0, 0];
  const earthRadius = Math.hypot(earthPos[0], earthPos[2]) || 3.1;
  const earthAngle = Math.atan2(earthPos[2], earthPos[0]);

  // 地球所在轨道的轨道圈
  group.add(orbitRing(earthRadius, palette.accent));

  const earth = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 2),
    matteMaterial(palette.model[0], { emissive: palette.accent, emissiveIntensity: 0.22 }),
  );
  earth.position.set(...earthPos);
  group.add(earth);

  /* ---- 其余行星 ---- */
  PLANET_SLOTS.forEach((slot, i) => {
    // 与地球角度过近的槽位跳过，避免视觉重叠
    const angularGap = Math.abs(
      Math.atan2(Math.sin(slot.angle - earthAngle), Math.cos(slot.angle - earthAngle)),
    );
    if (angularGap < 0.4) return;

    group.add(orbitRing(slot.r, palette.textDim));
    const p = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16 + (i % 3) * 0.07, 1),
      matteMaterial(palette.model[(i + 1) % palette.model.length]),
    );
    p.position.set(Math.cos(slot.angle) * slot.r, 0, Math.sin(slot.angle) * slot.r);
    group.add(p);
  });

  /* ---- 可点击光点 ---- */
  const marker = cfg.hotspot?.position ? createHotspotMarker(stage, cfg.hotspot.position) : null;
  if (marker) group.add(marker.group);

  return {
    group,
    update(t, dt, camera) {
      sun.rotation.y += dt * 0.12;
      earth.rotation.y += dt * 0.5;
      marker?.update(t, camera);
    },
  };
}
