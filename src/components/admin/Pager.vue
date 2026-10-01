<script setup>
/** 分页条 —— 只报页码，取数由父组件负责。 */
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:page']);

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

function go(delta) {
  const next = props.page + delta;
  if (next < 1 || next > pages.value) return;
  emit('update:page', next);
}
</script>

<template>
  <div class="pager">
    <span class="pager__info num">
      共 {{ total }} 条 · 第 {{ page }} / {{ pages }} 页
    </span>
    <span class="pager__btns">
      <button class="btn btn--sm" type="button" :disabled="disabled || page <= 1" @click="go(-1)">
        上一页
      </button>
      <button
        class="btn btn--sm"
        type="button"
        :disabled="disabled || page >= pages"
        @click="go(1)"
      >
        下一页
      </button>
    </span>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--border);
}
.pager__info {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
.pager__btns {
  display: flex;
  gap: var(--sp-2);
}
</style>
