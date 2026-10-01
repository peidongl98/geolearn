/**
 * 构件：自转球体（spin-sphere）
 *
 * 一个球 + 地轴 + 赤道圈。球面用真实贴图，
 * 自转方向靠海陆自己的移动就看得出来 —— 不需要额外的标记点或经线。
 *
 * ⚠️ 地轴倾角未接入：球体竖直放置，没有 23.5° 之类的数值。
 *    接入时必须同时给出数据来源（见章节 JSON 的 dataSource）。
 */
import * as THREE from 'three';
import { matteMaterial, texturedMaterial } from '../lib/matte.js';
import { getTexture } from '../lib/textures.js';

const RADIUS = 1.6;

/** 细圆环（赤道圈） */
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
  const texture = getTexture(cfg.texture);

  /* ---- 球体（会转）---- */
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 72, 48),
    texture ? texturedMaterial(texture) : matteMaterial(palette.model[0]),
  );
  group.add(sphere);

  /* ---- 地轴（不转）---- */
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -RADIUS * 1.45, 0),
      new THREE.Vector3(0, RADIUS * 1.45, 0),
    ]),
    new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.textDim),
      transparent: true,
      opacity: 0.5,
    }),
  );
  group.add(axis);

  /* ---- 赤道圈（不转）---- */
  if (cfg.showEquator !== false) {
    const equator = thinRing(RADIUS * 1.004, palette.textFaint ?? palette.textDim, 0.28);
    equator.rotation.x = -Math.PI / 2;
    group.add(equator);
  }

  return {
    group,
    update(t, dt) {
      sphere.rotation.y += dt * spinRadPerSec;
    },
  };
}
