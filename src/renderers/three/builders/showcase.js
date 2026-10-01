/**
 * 构件：首页展示（showcase）
 *
 * 从**已经建好的真实模型**里随机挑一个放到首页，每次进站都可能不一样。
 * 骨架期的抽象几何体（球/环/立方体）已经删除 —— 有了真模型就不再摆白模。
 *
 * 关键处理：各构件都是按章节页的尺度造的（太阳系外接到 17.6，
 * 自转球体只有 1.6），直接搬进首页会一个大得离谱、一个小到看不见。
 * 所以这里统一按**包围球**把内容缩放到同一个半径，首页相机的取景才稳定。
 *
 * ⚠️ 这里直接 import 各个构件，**不要**改成从 builders/index.js 取 BUILDERS ——
 *    那样会和注册表形成循环依赖（index 导入本文件，本文件又回头导入 index）。
 */
import * as THREE from 'three';
import { buildSolarSystem } from './solarSystem.js';
import { buildEarthMoon } from './earthMoon.js';
import { buildSpinSphere } from './spinSphere.js';
import { buildGalaxyDisc } from './galaxyDisc.js';

/** 缩放后内容「最长边」的目标长度 —— 与 HomeStage 的相机（距离约 5.4 / fov 42）配套 */
const TARGET_LONGEST = 3.6;

/**
 * 随机池。每项 = 用哪个构件 + 传什么配置。
 * 都是真实模型；想调整首页展示什么，改这个数组即可，不用动别处。
 */
const POOL = [
  { build: buildSolarSystem, cfg: { earthTexture: 'earth-day' }, name: 'solar-system' },
  { build: buildEarthMoon, cfg: { earthTexture: 'earth-day' }, name: 'earth-moon' },
  {
    build: buildSpinSphere,
    cfg: { texture: 'earth-day', spinDegPerSec: 10, showEquator: true },
    name: 'spin-sphere',
  },
  { build: buildGalaxyDisc, cfg: {}, name: 'galaxy-disc' },
];

/**
 * 摘掉标记为「背景」的对象（星空点云）。
 * 两个原因：① 它的半径远大于主体，会把包围盒撑爆、把模型缩成一团；
 *          ② 首页本来就是深色底，不需要再铺一层星点。
 */
function stripBackground(root) {
  const doomed = [];
  root.traverse((o) => {
    if (o.userData?.excludeFromBounds) doomed.push(o);
  });
  for (const o of doomed) {
    o.parent?.remove(o);
    o.geometry?.dispose();
    o.material?.dispose?.();
  }
}

export function buildShowcase(stage, cfg = {}) {
  const wrapper = new THREE.Group();

  const pick = cfg.pick ?? POOL[Math.floor(Math.random() * POOL.length)];

  const sub = pick.build(stage, pick.cfg ?? {});
  stripBackground(sub.group);
  wrapper.add(sub.group);

  /* ---- 统一尺度 ----
   * 按**包围盒最长边**缩放，不按包围球：自转球那根地轴会显著拉长包围球，
   * 用它当基准会把地球缩得偏小。最长边能保证「不管抽到哪个，都不会超出画面」。
   */
  const box = new THREE.Box3().setFromObject(sub.group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const k = longest > 0 ? TARGET_LONGEST / longest : 1;

  sub.group.scale.setScalar(k);
  // 顺便把内容居中，避免重心偏在一侧
  sub.group.position.set(-center.x * k, -center.y * k, -center.z * k);

  return {
    group: wrapper,
    // 首页是入口，不放天体名称标签，保持干净
    labels: [],
    update(t, dt, camera) {
      sub.update?.(t, dt, camera);
    },
    /** 供调试/测试确认当前抽到的是哪个 */
    picked: pick.name,
  };
}
