/**
 * 构件：几何体随机组合（geometry-combo）—— 首页用。
 *
 * 从球体 / 环体 / 立方体里随机挑 1–3 个，等大、同一套光照与材质，
 * 组成一个小簇，缓慢自转。本批为占位视觉，不承载知识点。
 */
import * as THREE from 'three';
import { matteMaterial } from '../lib/matte.js';

const SHAPES = ['sphere', 'torus', 'box'];

/** 位置预设：按数量给出不重叠的排布，让构图每次都不一样但都不难看 */
const LAYOUTS = {
  1: [[0, 0, 0]],
  2: [
    [-0.78, 0, 0],
    [0.78, 0, 0],
  ],
  3: [
    [0, 0.66, 0],
    [-0.92, -0.42, 0],
    [0.92, -0.42, 0],
  ],
};

/** 统一外接半径 R，各几何体反推自身参数，保证「看起来一样大」 */
function makeShape(kind, R) {
  switch (kind) {
    case 'sphere':
      return new THREE.SphereGeometry(R, 20, 14);
    case 'torus':
      return new THREE.TorusGeometry(R * 0.72, R * 0.3, 12, 36);
    case 'box':
      return new THREE.BoxGeometry(R * 1.6, R * 1.6, R * 1.6);
    default:
      return new THREE.SphereGeometry(R, 20, 14);
  }
}

function pickShapes(n) {
  const pool = [...SHAPES];
  const picked = [];
  while (picked.length < n && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

export function buildGeometryCombo(stage, cfg = {}) {
  const group = new THREE.Group();
  const { palette } = stage;

  const n = Math.min(3, Math.max(1, cfg.count ?? (1 + Math.floor(Math.random() * 3))));
  const kinds = pickShapes(n);
  const layout = LAYOUTS[n] ?? LAYOUTS[1];
  const R = 0.68;

  kinds.forEach((kind, i) => {
    const mesh = new THREE.Mesh(
      makeShape(kind, R),
      matteMaterial(palette.model[i % palette.model.length]),
    );
    mesh.position.set(...(layout[i] ?? [0, 0, 0]));
    mesh.rotation.set(Math.random() * 0.6, Math.random() * 0.6, 0);
    group.add(mesh);
  });

  const spin = cfg.spinDegPerSec ?? 14;

  return {
    group,
    update(t, dt) {
      group.rotation.y += (dt * spin * Math.PI) / 180;
    },
  };
}
