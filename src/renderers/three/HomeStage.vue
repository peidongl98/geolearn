<script setup>
/**
 * 首页 3D 模型区 —— 每次进入随机一个几何体组合。
 * 拖动旋转 / 滚轮缩放由 OrbitControls 提供；自转由构件自己转。
 */
import { ref } from 'vue';
import { useStage, useBuilder } from './lib/useStage.js';

const host = ref(null);

const stage = useStage(host, () => ({
  fov: 42,
  near: 0.1,
  far: 60,
  position: [0, 0.8, 5.4],
  minDistance: 3.2,
  maxDistance: 10,
}));

useBuilder(stage, () => 'geometry-combo', () => ({}));
</script>

<template>
  <div class="home-stage">
    <div ref="host" class="home-stage__canvas"></div>
    <p class="home-stage__hint">拖动旋转 · 滚轮缩放</p>
  </div>
</template>

<style scoped>
.home-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.home-stage__canvas {
  position: absolute;
  inset: 0;
}

.home-stage__hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 104px; /* 让开固定在底部的「选择章节」按钮 */
  margin: 0;
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--text-faint);
  pointer-events: none;
}
</style>
