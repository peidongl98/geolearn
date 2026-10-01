<script setup>
/**
 * 读条界面 —— 全屏纯进度条。
 *
 * 只听 LOAD_START 事件，不 import 抽屉组件；
 * 进度不是假的：边播边 fetch 目标页，读的是真实字节流。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { on, EVT } from '../../lib/bus.js';

const active = ref(false);
const title = ref('');
const progress = ref(0);

/** 最少停留时长，避免本地秒开时读条一闪 */
const MIN_VISIBLE_MS = 620;

async function preload(url, onProgress) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok || !res.body) {
    onProgress(1);
    return;
  }
  const total = Number(res.headers.get('content-length') ?? 0);
  const reader = res.body.getReader();
  let got = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value?.byteLength ?? 0;
    // 留 10% 给「跳转 + 首屏渲染」，进度条不会先满后等
    onProgress(total > 0 ? Math.min(0.9, (got / total) * 0.9) : Math.min(0.7, got / 60000 + 0.15));
  }
  onProgress(0.9);
}

async function run(payload) {
  if (active.value) return;
  const href = payload?.href;
  if (!href) return;

  title.value = payload.title ?? '';
  progress.value = 0;
  active.value = true;

  const started = performance.now();
  try {
    await preload(href, (p) => {
      if (p > progress.value) progress.value = p;
    });
  } catch {
    // 预载失败也照样跳过去，绝不能把用户卡在读条页
  }

  const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - started));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  progress.value = 1;
  await new Promise((r) => setTimeout(r, 200));

  location.href = href;
}

let off = null;
onMounted(() => {
  off = on(EVT.LOAD_START, run);
});
onBeforeUnmount(() => off?.());
</script>

<template>
  <Transition name="loadfade">
    <div v-if="active" class="loader" role="status" aria-live="polite">
      <div class="loader__inner">
        <p class="loader__label">正在进入</p>
        <h2 class="loader__title">{{ title }}</h2>

        <div class="loader__track">
          <div class="loader__fill" :style="{ transform: `scaleX(${progress})` }"></div>
        </div>

        <p class="loader__pct num">{{ Math.round(progress * 100) }}%</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loader {
  position: fixed;
  inset: 0;
  z-index: var(--z-loader);
  display: grid;
  place-items: center;
  background: var(--bg);
}

.loader__inner {
  width: min(420px, 78vw);
  text-align: center;
}

.loader__label {
  margin: 0;
  font-size: var(--fs-xs);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.loader__title {
  margin: var(--sp-3) 0 var(--sp-6);
  font-size: var(--fs-lg);
  color: var(--text);
}

.loader__track {
  position: relative;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}

.loader__fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  background: var(--accent);
  transition: transform 0.25s var(--ease);
}

.loader__pct {
  margin: var(--sp-4) 0 0;
  font-size: var(--fs-sm);
  color: var(--text-dim);
}

.loadfade-enter-active,
.loadfade-leave-active {
  transition: opacity var(--t-base) var(--ease);
}
.loadfade-enter-from,
.loadfade-leave-to {
  opacity: 0;
}
</style>
