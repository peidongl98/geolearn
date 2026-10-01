/**
 * 构件：自转球体（spin-sphere）
 *
 * 两种外观：
 *   - cfg.texture 给了名字 → 真实贴图的**光滑球体**（地球：海陆冰一眼可见）
 *   - 没给 → 低多边形占位球 + 随转经线（骨架期原本的样子）
 *
 * 两种外观都保留地轴与赤道圈，它们是有教学意义的参照物。
 *
 * ⚠️ 仍然是占位模型：**地轴倾角未接入**，球体竖直放置、无 23.5° 之类数值。
 *    接入真实倾角时必须同时给出数据来源（见章节 JSON 的 dataSource 字段）。
 */
import * as THREE from 'three';
import { matteMaterial, texturedMaterial } from '../lib/matte.js';
import { getTexture } from '../lib/textures.js';

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
  const texture = getTexture(cfg.texture);

  /* ---- 会转的部分 ---- */
  const rotor = new THREE.Group();

  if (texture) {
    // 有贴图：光滑高分段球体。赤道、极冠已经长在图上了，不必再画经线。
    rotor.add(
      new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 72, 48), texturedMaterial(texture)),
    );

    // 赤道上的小标记点：用来一眼看出自转方向
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent) }),
    );
    dot.position.set(RADIUS * 1.03, 0, 0);
    rotor.add(dot);
  } else {
    rotor.add(
      new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 22), matteMaterial(palette.model[0])),
    );

    const meridian = thinRing(RADIUS * 1.002, palette.accentSoft, 0.5);
    meridian.rotation.y = Math.PI / 2;
    rotor.add(meridian);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 14, 14),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent) }),
    );
    dot.position.set(RADIUS * 1.02, 0, 0);
    rotor.add(dot);
  }

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
