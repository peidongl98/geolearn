/**
 * 构件：地球公转（earth-revolution）
 *
 * 太阳 + 地球公转轨道 + 沿轨道运行的地球（同时自转）。
 * 这一级只讲「公转」，所以地球明显放大，太阳缩到示意大小。
 *
 * ── 真实数据 ────────────────────────────────────────────────
 *   日地平均距离（1 AU）     1.496×10⁸ km
 *   公转周期                 365.256 天
 *   公转方向                 自西向东（从北极上方看为逆时针）
 *   来源：《地球概论（第四版）》表 2-2。
 *
 * ── 显示说明 ────────────────────────────────────────────────
 *   轨道半径与天体大小均为示意；公转**速度是为了看得清而取的观感值**，
 *   与真实的 365 天没有数量关系（真按比例会慢到看不出在动）。
 *   轨道按正圆处理 —— 真实轨道偏心率 0.017，肉眼看不出扁。
 *
 * ⚠️ 未接入：地轴倾角（23°26′）、黄赤交角，因此本模型**不能**用来讲四季成因。
 */
import * as THREE from 'three';
import { matteMaterial, texturedMaterial } from '../lib/matte.js';
import { createStarfield } from '../lib/starfield.js';
import { getTexture } from '../lib/textures.js';

const ORBIT_R = 4.2;
const EARTH_R = 0.55;
const SUN_R = 0.66;
/** 公转速度（弧度/秒）—— 观感取值 */
const ANGULAR_SPEED = 0.22;

export function buildEarthRevolution(stage, cfg = {}) {
  const group = new THREE.Group();
  const { palette } = stage;

  group.add(createStarfield(stage, { count: 320, radius: 30, size: 0.07 }));

  /* ---- 太阳 ---- */
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R, 40, 28),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f6cf8a'),
      emissive: new THREE.Color('#f6cf8a'),
      emissiveIntensity: 0.9,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  group.add(sun);

  /* ---- 公转轨道 ---- */
  const pts = [];
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * ORBIT_R, 0, -Math.sin(a) * ORBIT_R));
  }
  group.add(
    new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(palette.accentSoft),
        transparent: true,
        opacity: 0.55,
      }),
    ),
  );

  /* ---- 地球 ---- */
  const texture = getTexture(cfg.earthTexture);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R, 56, 36),
    // 夜面自发光调高一点：公转这一级地球本来就小，背光那半再全黑就看不见了
    texture ? texturedMaterial(texture, { nightGlow: 0.22 }) : matteMaterial(palette.model[0]),
  );
  group.add(earth);

  /* 公转方向：自西向东，从北极上方看为逆时针 → 角度递增，位置取 (cos, -sin) */
  let angle = cfg.startAngle ?? 0;

  function earthPos() {
    return [Math.cos(angle) * ORBIT_R, 0, -Math.sin(angle) * ORBIT_R];
  }

  earth.position.set(...earthPos());

  return {
    group,
    labels: [{ key: 'sun-label', text: '太阳', position: [0, SUN_R + 0.34, 0], muted: true }],
    /**
     * 动态锚点：地球在动，「点地球进入下一级」的光点必须跟着动，
     * 不能只在初始化时定位一次。
     * 位置抬到球体上方 —— 否则标签会正好压在地球上，把球挡住。
     */
    anchorPositions: () => ({
      hotspot: [earth.position.x, earth.position.y + EARTH_R + 0.42, earth.position.z],
    }),
    update(t, dt) {
      angle += dt * ANGULAR_SPEED;
      earth.position.set(...earthPos());
      earth.rotation.y += dt * 1.6; // 自转比公转快得多，符合直观
      sun.rotation.y += dt * 0.06;
    },
  };
}
