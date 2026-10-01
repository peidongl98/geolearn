/**
 * 场景构件注册表 —— key 就是模型 JSON 里 config.stages[].body / config.body 的值。
 *
 * 加一种模型 = 写一个 builder 文件 + 在这里加一行。
 * 已有场景一行都不用动。
 *
 * builder 接口：
 *   build(stage, cfg) => { group: THREE.Object3D, update?(t, dt, camera) , hotspots?: vec3[] }
 *   - group   会自动被加进场景
 *   - update  每帧调用（可选）
 *   - 返回的 group 里的所有 geometry/material 会随 stage.dispose() 一起释放
 */
import { buildGalaxyDisc } from './galaxyDisc.js';
import { buildSolarSystem } from './solarSystem.js';
import { buildEarthMoon } from './earthMoon.js';
import { buildSpinSphere } from './spinSphere.js';
import { buildGeometryCombo } from './geometryCombo.js';

export const BUILDERS = {
  'galaxy-disc': buildGalaxyDisc,
  'solar-system': buildSolarSystem,
  'earth-moon': buildEarthMoon,
  'spin-sphere': buildSpinSphere,
  'geometry-combo': buildGeometryCombo,
};

export function getBuilder(name) {
  const b = BUILDERS[name];
  if (!b) {
    console.warn(`[renderers] 未注册的构件：${name}（可选：${Object.keys(BUILDERS).join(', ')}）`);
    return null;
  }
  return b;
}
