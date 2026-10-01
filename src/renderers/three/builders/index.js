/**
 * 场景构件注册表 —— key 就是模型 JSON 里 config.stages[].body / config.body 的值。
 *
 * 加一种模型 = 写一个 builder 文件 + 在这里加一行。
 * 已有场景一行都不用动。
 *
 * builder 接口：
 *   build(stage, cfg) => {
 *     group,                              // 必填：会自动加进场景
 *     update?(t, dt, camera),             // 可选：每帧调用
 *     labels?: [{ key, text, position, muted? }],   // 可选：HTML 名称标签
 *     anchorPositions?: () => Record<key, number[]>, // 可选：动态锚点
 *   }
 *
 *   - labels 的 position 是静态坐标；有 anchorPositions 时，同 key 的动态坐标优先。
 *     用途：地球这类**会动**的目标，光点和标签必须每帧跟随（见 earthRevolution）。
 *   - group 里的 geometry / material 会随 stage.dispose() 一起释放。
 */
import { buildGalaxyDisc } from './galaxyDisc.js';
import { buildSolarSystem } from './solarSystem.js';
import { buildEarthMoon } from './earthMoon.js';
import { buildSpinSphere } from './spinSphere.js';
import { buildEarthRevolution } from './earthRevolution.js';
import { buildShowcase } from './showcase.js';

export const BUILDERS = {
  'galaxy-disc': buildGalaxyDisc,
  'solar-system': buildSolarSystem,
  'earth-moon': buildEarthMoon,
  'spin-sphere': buildSpinSphere,
  'earth-revolution': buildEarthRevolution,
  'showcase': buildShowcase,
};

export function getBuilder(name) {
  const b = BUILDERS[name];
  if (!b) {
    console.warn(`[renderers] 未注册的构件：${name}（可选：${Object.keys(BUILDERS).join(', ')}）`);
    return null;
  }
  return b;
}
