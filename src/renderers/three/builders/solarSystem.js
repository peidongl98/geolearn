/**
 * 构件：太阳系（solar-system）
 *
 * 太阳 + 八大行星 + 各自的轨道 + 主小行星带 + 土星环。
 * 地球位置由 cfg.hotspot.position 决定，保证「光点标记」与地球本体永远重合 —— 改 JSON 就够了。
 *
 * ── 真实数据（用于计算示意位置）────────────────────────────────
 *   轨道半长径 / AU：0.387 0.723 1.000 1.524 5.205 9.576 19.28 30.13
 *   赤道半径  / km ：2440 6052 6378 3396 71492 60268 25559 24764
 *   太阳半径  / km ：696000
 *   主小行星带       2.1–3.3 AU
 *   来源：《地球概论（第四版）》表 2-2；与 NASA "Our Solar System" 数值一致。
 *        小行星带范围取 ESA "Small objects in the Solar System"（2.1–3.3 AU）。
 *
 * ── 显示用的压缩（关键，务必读懂）──────────────────────────────
 *   真实的太阳系没法在一个画面里同时看清结构与个体：水星 0.39 AU、海王星 30 AU
 *   相差 78 倍，而木星半径是水星的 29 倍。任何教科书插图都不按真实比例画。
 *   本项目采用两处压缩，并把压缩方式写进 dataSource 供读者判断：
 *     轨道半径 = 3.6 × AU^0.45      （幂压缩：拉开内行星，收住外行星）
 *     行星半径 = 0.20 × √(R/R地球)   （平方根压缩：保留"木星最大、水星最小"的次序）
 *   太阳半径 0.9 为观感取值（真实值是地球的 109 倍，按上式会大到吞掉水星轨道）。
 *   → 所以：**行星位置的先后次序是真实的，距离与大小不是。**
 *
 * ⚠️ 行星只自转、不公转：这一级的交互是「找到地球」，动来动去的球点不准。
 *    公转放在 1.2 单独讲。
 */
import * as THREE from 'three';
import { matteMaterial, texturedMaterial } from '../lib/matte.js';
import { createHotspotMarker } from '../lib/hotspot.js';
import { createStarfield } from '../lib/starfield.js';
import { getTexture } from '../lib/textures.js';
import { bandedTexture } from '../lib/procedural.js';

/* ---------------------------------------------------------------- 参数 */

const ORBIT_A = 3.6;
const ORBIT_K = 0.45;
const BODY_K = 0.2;
const SUN_R = 0.9;

/** 真实轨道半长径（AU） */
const ORBIT_AU = [0.387, 0.723, 1.0, 1.524, 5.205, 9.576, 19.28, 30.13];
/** 真实赤道半径（km） */
const RADIUS_KM = [2440, 6052, 6378, 3396, 71492, 60268, 25559, 24764];
/** 主小行星带范围（AU） */
const BELT_AU = [2.1, 3.3];

/** 起始角度（弧度）—— 纯为构图错开，无天文含义 */
const PHASE = [0.35, 1.95, 3.4, 5.1, 0.95, 2.6, 4.4, 5.85];

const orbitR = (au) => ORBIT_A * Math.pow(au, ORBIT_K);
const bodyR = (km) => BODY_K * Math.sqrt(km / 6378);

/**
 * 八颗行星的外观。
 * 颜色与条带是**观感示意**（不是实拍影像），只有地球用的是真实贴图。
 * 木星、土星的横向云带用程序化贴图现画 —— 那是它们最显著的特征。
 */
const PLANETS = [
  { id: 'mercury', cn: '水星', color: '#8c8378' },
  { id: 'venus', cn: '金星', color: '#dccfa6' },
  { id: 'earth', cn: '地球', texture: true },
  { id: 'mars', cn: '火星', color: '#b5522f' },
  {
    id: 'jupiter',
    cn: '木星',
    color: '#d8bd93',
    bands: ['#b99a72', '#d8bd93', '#efe0c4', '#c9ab84', '#e6d3ae'],
  },
  {
    id: 'saturn',
    cn: '土星',
    color: '#e0cfa0',
    bands: ['#c8b587', '#e0cfa0', '#f0e5c6', '#d2c093'],
  },
  { id: 'uranus', cn: '天王星', color: '#a5dbe0' },
  { id: 'neptune', cn: '海王星', color: '#4b6fd4' },
];

/* ---------------------------------------------------------------- 工具 */

/** 一条轨道线（闭合圆），比画整圈 Torus 省得多 */
function orbitLine(radius, color, opacity) {
  const pts = [];
  const SEG = 160;
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
    }),
  );
}

/**
 * 主小行星带：粒子环。
 * 真实的小行星带非常空旷（探测器穿过碰撞概率低于十亿分之一），
 * 所以这里刻意画得稀疏 —— 画成"密密的石头圈"是常见的错误示意。
 */
function asteroidBelt(stage) {
  const rIn = orbitR(BELT_AU[0]);
  const rOut = orbitR(BELT_AU[1]);
  const COUNT = 2600;

  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = rIn + Math.random() * (rOut - rIn);
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.09;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: new THREE.Color(stage.palette.textDim),
      size: 0.028,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
  );
}

/** 土星环：内环 + 外环，中间留出卡西尼缝（真实存在的显著特征） */
function saturnRings(planetR) {
  const g = new THREE.Group();
  const bands = [
    { from: 1.24, to: 1.72, opacity: 0.5 },
    { from: 1.8, to: 2.27, opacity: 0.36 },
  ];
  for (const b of bands) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(planetR * b.from, planetR * b.to, 96, 1),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#e8dcb4'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: b.opacity,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
  }
  // 土星自转轴倾角约 26.7°，环面随之一并倾斜
  g.rotation.z = THREE.MathUtils.degToRad(26.7);
  return g;
}

/* ---------------------------------------------------------------- 构件 */

export function buildSolarSystem(stage, cfg) {
  const group = new THREE.Group();
  const { palette } = stage;

  group.add(createStarfield(stage, { count: 420, radius: 46, size: 0.085 }));

  /* ---- 太阳 ---- */
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R, 48, 32),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f6cf8a'),
      emissive: new THREE.Color('#f6cf8a'),
      emissiveIntensity: 0.85,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  group.add(sun);

  const labels = [{ key: 'sun', text: '太阳', position: [0, SUN_R + 0.34, 0], muted: true }];
  const spinners = [sun];

  /* ---- 八大行星 ---- */
  const earthHotspot = cfg.hotspot?.position ?? null;
  const earthTexture = getTexture(cfg.earthTexture);

  PLANETS.forEach((p, i) => {
    const r = bodyR(RADIUS_KM[i]);
    const isEarth = p.id === 'earth';

    // 地球位置以配置为准（保证与光点重合），其余按起始角度环绕
    let pos;
    if (isEarth && earthHotspot) {
      pos = earthHotspot;
    } else {
      const radius = orbitR(ORBIT_AU[i]);
      pos = [Math.cos(PHASE[i]) * radius, 0, Math.sin(PHASE[i]) * radius];
    }

    // 轨道：地球那条亮一点，其余压暗（8 条等亮的圈在画面里很吵）
    group.add(
      orbitLine(
        orbitR(ORBIT_AU[i]),
        isEarth ? palette.accentSoft : palette.textDim,
        isEarth ? 0.5 : 0.22,
      ),
    );

    // 球体
    let material;
    if (p.texture && earthTexture) {
      material = texturedMaterial(earthTexture);
    } else if (p.bands) {
      const tex = bandedTexture(p.bands, { bands: p.id === 'jupiter' ? 18 : 14 });
      material = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.1,
        roughness: 0.9,
        metalness: 0,
      });
    } else {
      material = matteMaterial(p.color);
      material.flatShading = false; // 天体要光滑，不跟着低多边形走
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), material);
    mesh.position.set(...pos);
    group.add(mesh);
    spinners.push(mesh);

    if (p.id === 'saturn') {
      const rings = saturnRings(r);
      rings.position.set(...pos);
      group.add(rings);
    }

    // 名称标签：地球的标签由「可点击光点」承担，避免叠字
    if (!isEarth) {
      labels.push({ key: p.id, text: p.cn, position: [pos[0], pos[1] + r + 0.24, pos[2]] });
    }
  });

  /* ---- 主小行星带 ---- */
  group.add(asteroidBelt(stage));
  labels.push({
    key: 'belt',
    text: '小行星带',
    position: [0, 0.42, orbitR((BELT_AU[0] + BELT_AU[1]) / 2)],
    muted: true,
  });

  /* ---- 可点击光点（地球）---- */
  const marker = earthHotspot ? createHotspotMarker(stage, earthHotspot) : null;
  if (marker) group.add(marker.group);

  return {
    group,
    labels,
    update(t, dt, camera) {
      // 只自转、不公转（见文件头说明）
      for (let i = 0; i < spinners.length; i++) {
        spinners[i].rotation.y += dt * (i === 0 ? 0.05 : 0.28);
      }
      marker?.update(t, camera);
    },
  };
}
