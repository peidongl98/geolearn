<script setup>
/**
 * 探索式导航渲染器 —— 逐级放大 / 收束。
 *   1.1：银河系 → 太阳系 → 地月系
 *   1.2：地球的公转 → 地球的自转
 *
 * 本组件只做「编排」：级数列表、镜头推进与回退、换场、贴片跟随。
 * 每一级长什么样由 builders/ 里的构件决定（见模型 JSON 的 stages[].body）。
 * 加一级 = 在章节 JSON 的 stages 里加一项 + 注册一个 builder，本文件不用改。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useStage, useBuilder, useBillboards } from './lib/useStage.js';
import { fitCameraToContent } from './lib/bounds.js';

const props = defineProps({
  /** 渲染器配置：{ type, config, dataSource }，由章节 JSON 提供 */
  model: { type: Object, required: true },
});

const cfg = computed(() => props.model.config ?? {});
const stages = computed(() => cfg.value.stages ?? []);
const idx = ref(0);
const current = computed(() => stages.value[idx.value] ?? null);
const busy = ref(false);
const canGoBack = computed(() => idx.value > 0);

const host = ref(null);

/* ---------------------------------------------------------- 相机取位 */

function aspect() {
  const el = host.value;
  if (!el) return 1.8;
  return (el.clientWidth || 1) / (el.clientHeight || 1);
}

/**
 * 一级场景的取景 —— 返回相机位置与注视点。
 *
 *   写了 cameraDir（视角方向）→ **按内容自动取景**：
 *     把构件里的真实顶点投到相机基上，算出刚好装得下的距离。
 *     这样太阳系这种「大而扁」的场景不会被包围盒坑到推远一倍，
 *     换屏幕尺寸也会重新装框（手机竖屏也能看全）。
 *   否则用 JSON 里写死的 cameraPos。
 */
function frameFor(stageCfg) {
  const s = stage.value;
  const b = built.value;

  if (stageCfg?.cameraDir && s && b?.group) {
    const fitted = fitCameraToContent(b.group, {
      dir: stageCfg.cameraDir,
      fov: cfg.value.camera?.fov ?? 45,
      aspect: aspect(),
      margin: 1.12,
    });
    if (fitted) {
      if (stageCfg.cameraTarget) fitted.target = stageCfg.cameraTarget;
      return fitted;
    }
  }

  return {
    position: stageCfg?.cameraPos ?? [0, 6, 20],
    target: stageCfg?.cameraTarget ?? [0, 0, 0],
  };
}

/* ---------------------------------------------------------- 舞台与场景 */

const stage = useStage(host, () => ({
  fov: cfg.value.camera?.fov ?? 45,
  near: cfg.value.camera?.near ?? 0.1,
  far: cfg.value.camera?.far ?? 400,
  position: frameFor(stages.value[0]).position,
  minDistance: 2.4,
  maxDistance: 64,
}));

/** 换 idx 会自动释放旧场景再重建 */
const built = useBuilder(
  stage,
  () => current.value?.body,
  () => current.value ?? {},
  idx,
);

/** 构件建好后按内容自动装框（换场途中别插手，那时镜头归 advance/goBack 管） */
watch(built, () => {
  const s = stage.value;
  const c = current.value;
  if (!s || busy.value || !c?.cameraDir) return;
  const f = frameFor(c);
  s.snapTo(f.position, f.target);
});

/** 窗口尺寸变了要重新取景（只对用 cameraDir 的级有意义） */
function retarget() {
  const s = stage.value;
  const c = current.value;
  if (!s || busy.value || !c?.cameraDir) return;
  const f = frameFor(c);
  s.snapTo(f.position, f.target);
}
onMounted(() => window.addEventListener('resize', retarget));
onBeforeUnmount(() => window.removeEventListener('resize', retarget));

/* ---------------------------------------------------------- 贴片跟随 */

const labels = computed(() => built.value?.labels ?? []);

const { register } = useBillboards(stage, () => {
  const s = stage.value;
  if (!s) return [];

  // 构件可以给「动态锚点」：地球在动，光点就得跟着动，不能只定位一次
  const anchors = built.value?.anchorPositions?.() ?? {};
  const out = [];

  const h = current.value?.hotspot;
  if (h?.position && !busy.value) {
    out.push({ key: 'hotspot', position: anchors.hotspot ?? h.position });
  }
  for (const l of labels.value) {
    out.push({ key: l.key, position: anchors[l.key] ?? l.position });
  }
  return out;
});

/* ---------------------------------------------------------- 换场 */

/** 「离某个点很近」的位置，用于推进 / 拉开的过渡 */
function approachPoint(s, point, distance) {
  const THREE = s.THREE;
  const target = new THREE.Vector3(...point);
  return target
    .clone()
    .addScaledVector(s.camera.position.clone().sub(target).normalize(), distance)
    .toArray();
}

/** 在某个点外侧「退开一点」的位置（回退时从上一级目标外面拉开用） */
const pullbackPoint = (point, scale = 1.5, lift = 0.6) => [
  point[0] * scale,
  point[1] + lift,
  point[2] * scale,
];

/** 光点当前真实位置（有动态锚点就用锚点） */
const liveHotspot = () =>
  built.value?.anchorPositions?.().hotspot ?? current.value?.hotspot?.position;

async function advance() {
  const s = stage.value;
  const h = current.value?.hotspot;
  const nextIdx = idx.value + 1;
  const point = h?.position ? liveHotspot() : null;
  if (!s || busy.value || !h?.clickable || !point || nextIdx >= stages.value.length) return;

  busy.value = true;
  try {
    // 1) 向目标推进到很近的位置
    await s.flyTo(approachPoint(s, point, 0.9), point, cfg.value.transition?.durationMs ?? 1200);

    // 2) 换到下一级场景
    idx.value = nextIdx;
    await nextTick();
    if (!stage.value) return;

    // 3) 从近处拉开，露出新场景全貌
    s.snapTo([0, 0.5, 2.0], [0, 0, 0]);
    const fit = frameFor(stages.value[nextIdx]);
    await s.flyTo(fit.position, fit.target, 780);
  } finally {
    busy.value = false;
  }
}

/** 返回上一级 —— 推进的镜像动作 */
async function goBack() {
  const s = stage.value;
  const prevIdx = idx.value - 1;
  if (!s || busy.value || prevIdx < 0) return;

  busy.value = true;
  try {
    // 1) 先朝当前场景中心推进（等于「退出这一级」）
    await s.flyTo([0, 0.4, 1.7], [0, 0, 0], 560);

    // 2) 换回上一级场景
    idx.value = prevIdx;
    await nextTick();
    if (!stage.value) return;

    // 3) 从上一级那个目标的里侧拉开，回到该级机位
    const prev = stages.value[prevIdx];
    const point = prev?.hotspot?.position;
    s.snapTo(point ? pullbackPoint(point) : [0, 0.5, 2.0], point ?? [0, 0, 0]);
    const fit = frameFor(prev);
    await s.flyTo(fit.position, fit.target, 900);
  } finally {
    busy.value = false;
  }
}

/** 换场期间镜头在动，自动旋转不要插手 */
watch(busy, () => stage.value?.setAutoRotate(false));
</script>

<template>
  <div class="sz" :class="{ 'sz--busy': busy }">
    <div ref="host" class="sz__canvas"></div>

    <div class="sz__hud">
      <div class="sz__bar">
        <ol class="sz__steps">
          <li
            v-for="(s, i) in stages"
            :key="s.id"
            class="sz__step"
            :class="{ 'is-on': i === idx, 'is-done': i < idx }"
          >
            {{ s.title }}
          </li>
        </ol>

        <button v-if="canGoBack" class="sz__back" type="button" :disabled="busy" @click="goBack">
          <span aria-hidden="true">←</span> 返回上一级
        </button>
      </div>

      <h2 class="sz__title">{{ current?.title }}</h2>
      <p v-if="current?.caption" class="sz__caption">{{ current.caption }}</p>
    </div>

    <!-- 天体名称：位置由 useBillboards 每帧写入 transform -->
    <span
      v-for="l in labels"
      :key="l.key"
      :ref="(el) => register(l.key, el)"
      class="sz__label"
      :class="{ 'sz__label--muted': l.muted }"
      aria-hidden="true"
    >
      {{ l.text }}
    </span>

    <button
      v-if="current?.hotspot?.position"
      :ref="(el) => register('hotspot', el)"
      class="sz__hotspot"
      type="button"
      :disabled="busy"
      :aria-label="`进入${current.hotspot.label}`"
      @click="advance"
    >
      <span class="sz__hotspot-dot" aria-hidden="true"></span>
      <span class="sz__hotspot-text">
        <b>{{ current.hotspot.label }}</b>
        <em>{{ current.hotspot.hint }}</em>
      </span>
    </button>

    <div class="sz__veil" aria-hidden="true"></div>

    <p class="sz__source">{{ props.model.dataSource }}</p>
  </div>
</template>

<style scoped>
.sz {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 40%, var(--surface) 0%, var(--bg) 68%);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}

/* canvas 以自己的属性尺寸参与布局，必须绝对定位铺满 */
.sz__canvas {
  position: absolute;
  inset: 0;
}

/* ---- 文案层 ---- */
.sz__hud {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  padding: var(--sp-5) var(--sp-5) var(--sp-6);
  pointer-events: none;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 88%, transparent) 0%, transparent 100%);
}

.sz__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
  margin-bottom: var(--sp-3);
}

.sz__steps {
  display: flex;
  gap: var(--sp-2);
  list-style: none;
  margin: 0;
  padding: 0;
  flex-wrap: wrap;
}
.sz__step {
  font-size: var(--fs-xs);
  color: var(--text-faint);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  padding: 2px var(--sp-3);
  transition: color var(--t-base) var(--ease), border-color var(--t-base) var(--ease);
}
.sz__step.is-done {
  color: var(--text-dim);
}
.sz__step.is-on {
  color: var(--accent-text);
  border-color: var(--accent-soft);
  background: var(--accent-dim);
}

/* ---- 返回上一级 ---- */
.sz__back {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  height: 28px;
  padding: 0 var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--text-dim);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-pill);
  pointer-events: auto;
  transition: color var(--t-base) var(--ease), border-color var(--t-base) var(--ease),
    background var(--t-base) var(--ease);
}
.sz__back:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--accent-soft);
  background: var(--accent-dim);
}
.sz__back:disabled {
  opacity: 0.5;
  cursor: progress;
}

.sz__title {
  font-size: var(--fs-lg);
  color: var(--text);
}
.sz__caption {
  margin: var(--sp-2) 0 0;
  max-width: 46ch;
  font-size: var(--fs-sm);
  color: var(--text-dim);
}

/* ---- 天体名称标签 ---- */
.sz__label {
  position: absolute;
  left: 0;
  top: 0;
  font-size: var(--fs-xs);
  color: var(--text);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
  will-change: transform;
}
.sz__label--muted {
  color: var(--text-dim);
}

/* ---- 可点击光点 ---- */
.sz__hotspot {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3) var(--sp-2) var(--sp-2);
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  backdrop-filter: blur(6px);
  border: 1px solid var(--accent-soft);
  border-radius: var(--r-pill);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--t-base) var(--ease), background var(--t-base) var(--ease);
  will-change: transform;
}
.sz__hotspot:hover:not(:disabled) {
  background: var(--accent-dim);
}
.sz__hotspot:disabled {
  cursor: progress;
}

.sz__hotspot-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
  flex: none;
}

.sz__hotspot-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  text-align: left;
}
.sz__hotspot-text b {
  font-size: var(--fs-sm);
  color: var(--accent-text);
  font-weight: 600;
}
.sz__hotspot-text em {
  font-size: var(--fs-xs);
  font-style: normal;
  color: var(--text-faint);
}

/* ---- 换场时的柔光遮罩 ---- */
.sz__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--text) 26%, transparent), transparent 70%);
  transition: opacity 0.34s var(--ease);
}
.sz--busy .sz__veil {
  opacity: 1;
}

/* ---- 引用来源 ---- */
.sz__source {
  position: absolute;
  left: var(--sp-5);
  right: var(--sp-5);
  bottom: var(--sp-4);
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--text-faint);
  pointer-events: none;
}

@media (max-width: 640px) {
  .sz__hud {
    padding: var(--sp-4) var(--sp-4) var(--sp-5);
  }
  .sz__title {
    font-size: var(--fs-md);
  }
  .sz__source {
    left: var(--sp-4);
    right: var(--sp-4);
  }
}
</style>
