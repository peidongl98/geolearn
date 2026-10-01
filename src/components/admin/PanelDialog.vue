<script setup>
/**
 * 只读信息弹窗 —— 「查看登录记录」「查看关联用户」这类纯展示用。
 * 与 ConfirmDialog 分开：那个负责「确认后执行动作」，这个只负责展示。
 */
import { onBeforeUnmount, onMounted } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  wide: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open']);

function close() {
  emit('update:open', false);
}

function onKeydown(e) {
  if (e.key === 'Escape' && props.open) close();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Transition name="pd">
    <div v-if="open" class="pd">
      <div class="pd__scrim" @click="close"></div>

      <div class="pd__panel" :class="{ 'pd__panel--wide': wide }" role="dialog" aria-modal="true">
        <header class="pd__head">
          <div>
            <h3 class="pd__title">{{ title }}</h3>
            <p v-if="subtitle" class="pd__sub">{{ subtitle }}</p>
          </div>
          <button class="pd__close" type="button" aria-label="关闭" @click="close">×</button>
        </header>

        <div class="pd__body">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pd {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--sp-4);
}
.pd__scrim {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 9, 0.66);
  backdrop-filter: blur(2px);
}
.pd__panel {
  position: relative;
  width: min(560px, 100%);
  max-height: 84svh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.pd__panel--wide {
  width: min(860px, 100%);
}
.pd__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-5);
  border-bottom: 1px solid var(--border);
}
.pd__title {
  font-size: var(--fs-md);
}
.pd__sub {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
.pd__close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  background: transparent;
  border-radius: var(--r-sm);
  color: var(--text-dim);
  font-size: 18px;
  line-height: 1;
}
.pd__close:hover {
  color: var(--text);
}
.pd__body {
  overflow-y: auto;
}

.pd-enter-active,
.pd-leave-active {
  transition: opacity var(--t-base) var(--ease);
}
.pd-enter-from,
.pd-leave-to {
  opacity: 0;
}
</style>
