<script setup>
/** 操作日志面板 —— 只读，不受编辑模式影响。 */
import { onMounted, ref } from 'vue';
import { api, ApiError } from '../../lib/http.js';
import LogTable from './LogTable.vue';
import Pager from './Pager.vue';

const PAGE_SIZE = 20;

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.admin.listLogs({ type: 'audit', page: page.value, pageSize: PAGE_SIZE });
    rows.value = res.logs ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function changePage(p) {
  page.value = p;
  load();
}

defineExpose({ reload: load });
</script>

<template>
  <section class="panel">
    <header class="panel__bar">
      <p class="panel__hint">记录「谁、什么时候、做了什么」。注册与系统清理也会入账。</p>
      <button class="btn" type="button" :disabled="loading" @click="load">刷新</button>
    </header>

    <p v-if="error" class="alert alert--error panel__msg">{{ error }}</p>

    <div class="card card--plain">
      <LogTable mode="audit" :rows="rows" />
      <p v-if="loading" class="empty">加载中…</p>
      <Pager :page="page" :page-size="PAGE_SIZE" :total="total" :disabled="loading" @update:page="changePage" />
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.panel__hint {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-dim);
}
.panel__msg {
  margin: 0;
}
</style>
