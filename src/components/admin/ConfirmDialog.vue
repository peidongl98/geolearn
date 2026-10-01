<script setup>
/**
 * 通用二次确认弹窗 —— 管理台所有行级操作都走它。
 *
 * 两个用途合一：
 *   - fields 为空  → 纯确认（删除、失效这类）
 *   - fields 有值  → 带输入框的确认（改名、重置密码、生成邀请码这类）
 *
 * 父组件只负责「准备一份描述 + 一个执行函数」，校验失败时用
 * dialogRef.setError(msg) 把错误显示回弹窗里。
 */
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  /** [{ key, label, type, value, placeholder, hint, min, max }] */
  fields: { type: Array, default: () => [] },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'confirm']);

const values = ref({});
const error = ref('');
const panel = ref(null);

watch(
  () => props.open,
  async (v) => {
    if (!v) {
      error.value = '';
      return;
    }
    values.value = Object.fromEntries(props.fields.map((f) => [f.key, f.value ?? '']));
    error.value = '';
    await nextTick();
    panel.value?.focus();
  },
);

function close() {
  if (props.busy) return;
  emit('update:open', false);
}

function confirm() {
  emit('confirm', { ...values.value });
}

function onKeydown(e) {
  if (e.key === 'Escape') close();
}

defineExpose({
  setError(msg) {
    error.value = msg;
  },
});
</script>

<template>
  <Transition name="cd">
    <div v-if="open" class="cd" @keydown="onKeydown">
      <div class="cd__scrim" @click="close"></div>

      <div
        ref="panel"
        class="cd__panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <h3 class="cd__title">{{ title }}</h3>
        <p v-if="message" class="cd__message">{{ message }}</p>

        <label v-for="f in fields" :key="f.key" class="field">
          <span class="field__label">{{ f.label }}</span>

          <select
            v-if="f.options"
            v-model="values[f.key]"
            class="input"
            :disabled="busy"
          >
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>

          <input
            v-else
            v-model="values[f.key]"
            class="input"
            :type="f.type ?? 'text'"
            :placeholder="f.placeholder ?? ''"
            :min="f.min"
            :max="f.max"
            :disabled="busy"
            @keydown.enter.prevent="confirm"
          />

          <span v-if="f.hint" class="field__hint">{{ f.hint }}</span>
        </label>

        <p v-if="error" class="alert alert--error cd__error">{{ error }}</p>

        <div class="cd__actions">
          <button class="btn" type="button" :disabled="busy" @click="close">
            {{ cancelText }}
          </button>
          <button
            class="btn"
            :class="danger ? 'btn--danger' : 'btn--primary'"
            type="button"
            :disabled="busy"
            @click="confirm"
          >
            {{ busy ? '处理中…' : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--sp-4);
}

.cd__scrim {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 9, 0.66);
  backdrop-filter: blur(2px);
}

.cd__panel {
  position: relative;
  width: min(420px, 100%);
  max-height: 88svh;
  overflow-y: auto;
  padding: var(--sp-5);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  outline: none;
}

.cd__title {
  font-size: var(--fs-md);
  color: var(--text);
}

.cd__message {
  margin: var(--sp-2) 0 var(--sp-5);
  font-size: var(--fs-sm);
  color: var(--text-dim);
  white-space: pre-wrap;
}

.cd__error {
  margin: 0 0 var(--sp-4);
}

.cd__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
}

.cd-enter-active,
.cd-leave-active {
  transition: opacity var(--t-base) var(--ease);
}
.cd-enter-from,
.cd-leave-to {
  opacity: 0;
}
</style>
