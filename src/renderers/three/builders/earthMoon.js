/**
 * 构件：地月系（earth-moon）
 *
 * 地球 + 绕转的月球 + 一条轨道圈。本场景没有可点击光点（探索到此为止）。
 *
 * 地球：cfg.earthTexture 给了名字就用真实贴图的光滑球体，否则用低多边形占位球。
 * 月球：暂不接贴图 —— Wikimedia 上的月球等距圆柱图有 65MB，不适合网页加载；
 *       找到够小且许可清楚的再补。
 *
 * ⚠️ 半径比、轨道半径、公转周期均为示意，不对应真实数值。
 */
import * as THREE from 'three';
import { matteMaterial, texturedMaterial } from '../lib/matte.js';
import { createStarfield } from '../lib/starfield.js';
import { getTexture } from '../lib/textures.js';

const EARTH_R = 0.95;
const MOON_R = 0.26;
const ORBIT_R = 2.5;

export function buildEarthMoon(stage, cfg = {}) {
  const group = new THREE.Group();
  const { palette } = stage;

  group.add(createStarfield(stage, { count: 380, radius: 26, size: 0.07 }));

  /* ---- 地球 ---- */
  const earthTex = getTexture(cfg.earthTexture);
  const earth = new THREE.Mesh(
    earthTex
      ? new THREE.SphereGeometry(EARTH_R, 64, 44)
      : new THREE.IcosahedronGeometry(EARTH_R, 3),
    earthTex ? texturedMaterial(earthTex) : matteMaterial(palette.model[0]),
  );
  group.add(earth);

  /* ---- 月球轨道 ---- */
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
    new THREE.IcosahedronGeometry(MOON_R, 2),
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
