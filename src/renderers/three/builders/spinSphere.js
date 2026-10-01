/**
 * 构件：自转球体（spin-sphere）
 *
 * 一个球 + 地轴 + 赤道圈 + 随球转动的一条经线和一个赤道标记点，
 * 让「自转」这件事一眼可见。
 *
 * ⚠️ 占位模型：**地轴倾角未接入**，当前球体竖直放置、无 23.5° 之类数值。
 *    接入真实倾角时必须同时给出数据来源（见章节 JSON 的 dataSource 字段）。
 */
import * as THREE from 'three';
import { matteMaterial } from '../lib/matte.js';

const RADIUS = 1.6;

/** 细圆环（经线 / 赤道圈共用） */
function thinRing(radius, color, opacity = 0.45) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.009, 3, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
}

export function buildSpinSphere(stage, cfg) {
  const group = new THREE.Group();
  const { palette } = stage;

  const spinRadPerSec = ((cfg.spinDegPerSec ?? 8) * Math.PI) / 180;

  /* ---- 会转的部分：球 + 一条经线 + 赤道标记点 ---- */
  const rotor = new THREE.Group();

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 32, 22),
    matteMaterial(palette.model[0]),
  );
  rotor.add(sphere);

  const meridian = thinRing(RADIUS * 1.002, palette.accentSoft, 0.5);
  meridian.rotation.y = Math.PI / 2;
  rotor.add(meridian);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent) }),
  );
  dot.position.set(RADIUS * 1.02, 0, 0);
  rotor.add(dot);

  group.add(rotor);

  /* ---- 不转的部分：地轴 + 赤道圈 ---- */
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -RADIUS * 1.45, 0),
    new THREE.Vector3(0, RADIUS * 1.45, 0),
  ]);
  const axis = new THREE.Line(
    axisGeo,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.textDim),
      transparent: true,
      opacity: 0.5,
    }),
  );
  group.add(axis);

  if (cfg.showAxis !== false) {
    const equator = thinRing(RADIUS * 1.004, palette.textFaint ?? palette.textDim, 0.28);
    equator.rotation.x = -Math.PI / 2;
    group.add(equator);
  }

  return {
    group,
    update(t, dt) {
      rotor.rotation.y += dt * spinRadPerSec;
    },
  };
}
