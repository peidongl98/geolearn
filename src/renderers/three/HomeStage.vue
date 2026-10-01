<script setup>
/**
 * 首页 3D 模型区 —— 每次进入从已建好的真实模型里随机挑一个展示。
 * 拖动旋转 / 滚轮缩放由 OrbitControls 提供；自转由构件自己转。
 */
import { ref } from 'vue';
import { useStage, useBuilder } from './lib/useStage.js';

const host = ref(null);

const stage = useStage(host, () => ({
  fov: 42,
  near: 0.1,
  far: 60,
  // 机位抬到约 20° 仰角：太阳系、银河系是**盘**，正对着看会压成一条线
  position: [0, 1.9, 5.1],
  minDistance: 3.0,
  maxDistance: 11,
}));

useBuilder(stage, () => 'showcase', () => ({}));
</script>

<template>
  <div class="home-stage">
    <div ref="host" class="home-stage__canvas"></div>
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
</style>
