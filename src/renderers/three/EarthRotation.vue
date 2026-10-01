<script setup>
/**
 * 1.2 地球的运动 —— 自转渲染器（本批只做自转占位）。
 *
 * 后续加「公转」不需要改本文件：新建一个 builders/xxx.js，
 * 在该节 JSON 里把 config.body 换掉即可。
 */
import { computed, ref } from 'vue';
import { useStage, useBuilder } from './lib/useStage.js';

const props = defineProps({
  model: { type: Object, required: true },
});

const cfg = computed(() => props.model.config ?? {});
const host = ref(null);

const stage = useStage(host, () => ({
  fov: cfg.value.camera?.fov ?? 42,
  near: cfg.value.camera?.near ?? 0.1,
  far: cfg.value.camera?.far ?? 200,
  position: cfg.value.cameraPos ?? [0, 1.8, 6.2],
  minDistance: 3.4,
  maxDistance: 14,
}));

useBuilder(
  stage,
  () => cfg.value.body,
  () => cfg.value,
);
</script>

<template>
  <div class="er">
    <div ref="host" class="er__canvas"></div>

    <div class="er__hud">
      <span class="er__tag">自转</span>
      <p v-if="cfg.caption" class="er__caption">{{ cfg.caption }}</p>
    </div>

    <p class="er__source">{{ props.model.dataSource }}</p>
  </div>
</template>

<style scoped>
.er {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 45%, var(--surface) 0%, var(--bg) 70%);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}

.er__canvas {
  position: absolute;
  inset: 0;
}

.er__hud {
  position: absolute;
  left: var(--sp-5);
  right: var(--sp-5);
  top: var(--sp-5);
  pointer-events: none;
}

.er__tag {
  display: inline-block;
  font-size: var(--fs-xs);
  color: var(--accent-text);
  border: 1px solid var(--accent-soft);
  background: var(--accent-dim);
  border-radius: var(--r-pill);
  padding: 2px var(--sp-3);
}

.er__caption {
  margin: var(--sp-3) 0 0;
  max-width: 46ch;
  font-size: var(--fs-sm);
  color: var(--text-dim);
}

.er__source {
  position: absolute;
  left: var(--sp-5);
  bottom: var(--sp-4);
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--text-faint);
  pointer-events: none;
}

@media (max-width: 640px) {
  .er__hud {
    left: var(--sp-4);
    right: var(--sp-4);
    top: var(--sp-4);
  }
  .er__source {
    left: var(--sp-4);
    right: var(--sp-4);
  }
}
</style>
