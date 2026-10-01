/**
 * 构件：地月系（earth-moon）
 *
 * 地球 + 绕转的月球 + 一条轨道圈。本场景没有可点击光点（探索到此为止）。
 *
 * ⚠️ 占位模型：半径比、轨道半径、公转周期均为示意，不对应真实数值。
 */
import * as THREE from 'three';
import { matteMaterial } from '../lib/matte.js';
import { createStarfield } from '../lib/starfield.js';

export function buildEarthMoon(stage) {
  const group = new THREE.Group();
  const { palette } = stage;

  group.add(createStarfield(stage, { count: 380, radius: 26, size: 0.07 }));

  /* ---- 地球 ---- */
  const earth = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 3),
    matteMaterial(palette.model[0]),
  );
  group.add(earth);

  /* ---- 月球轨道 ---- */
  const ORBIT_R = 2.5;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ORBIT_R, 0.006, 3, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accentSoft),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  /* ---- 月球 ---- */
  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.26, 2),
    matteMaterial(palette.textDim),
  );
  moon.position.set(ORBIT_R, 0, 0);
  moonPivot.add(moon);
  moonPivot.rotation.z = 0.18; // 轨道面轻微倾斜，看起来不像贴在同一平面
  group.add(moonPivot);

  return {
    group,
    update(t, dt) {
      earth.rotation.y += dt * 0.18;
      moonPivot.rotation.y += dt * 0.22;
      moon.rotation.y += dt * 0.22;
    },
  };
}
