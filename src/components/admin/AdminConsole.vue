<script setup>
/**
 * 管理台外壳 —— 顶部开关 + 三个面板。
 * 面板之间互不感知：各自取数、各自弹窗、各自分页。
 */
import { onMounted, ref } from 'vue';
import { ensureAdmin } from '../../lib/session.js';
import { api, ApiError } from '../../lib/http.js';
import ConfirmDialog from './ConfirmDialog.vue';
import UserPanel from './UserPanel.vue';
import InvitePanel from './InvitePanel.vue';
import LogPanel from './LogPanel.vue';

const TABS = [
  { key: 'users', label: '用户管理' },
  { key: 'invites', label: '邀请码管理' },
  { key: 'logs', label: '操作日志' },
];

const me = ref(null);
const tab = ref('users');
/** 编辑模式：关闭时为只读。每次进入默认关闭，避免误操作。 */
const editable = ref(false);

const CLEANUP_MESSAGE =
  '将物理删除「失效满 7 天」的邀请码，以及已过期的会话。\n邀请码使用记录（注册留痕）不会被删除。';

const cleanupOpen = ref(false);
const cleanupBusy = ref(false);
const cleanupResult = ref('');
const cleanupDialog = ref(null);

const logPanel = ref(null);

onMounted(async () => {
  me.value = await ensureAdmin();
});

async function runCleanup() {
  cleanupBusy.value = true;
  try {
    const res = await api.admin.cleanup();
    cleanupResult.value = `已删除失效邀请码 ${res.invitesDeleted} 个、过期会话 ${res.sessionsDeleted} 条。`;
    cleanupOpen.value = false;
    logPanel.value?.reload();
  } catch (e) {
    cleanupDialog.value?.setError(e instanceof ApiError ? e.message : '清理失败');
  } finally {
    cleanupBusy.value = false;
  }
}
</script>

<template>
  <div class="admin">
    <header class="admin__top">
      <nav class="admin__tabs" aria-label="管理台分区">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="tab"
          :class="{ 'is-on': tab === t.key }"
          type="button"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </nav>

      <div class="admin__tools">
        <button class="btn btn--sm" type="button" :disabled="!editable" @click="cleanupOpen = true">
          清理
        </button>

        <label class="switch" :title="editable ? '当前可操作' : '当前只读'">
          <input v-model="editable" type="checkbox" />
          <span class="switch__track"><span class="switch__dot"></span></span>
          <span class="switch__label">{{ editable ? '编辑模式：开' : '编辑模式：关（只读）' }}</span>
        </label>
      </div>
    </header>

    <p v-if="editable" class="alert admin__warn">
      编辑模式已开启。此状态下可增删改账号与邀请码，所有写操作都会记入操作日志。
    </p>
    <p v-if="cleanupResult" class="alert alert--ok admin__warn">{{ cleanupResult }}</p>

    <UserPanel v-if="tab === 'users'" :editable="editable" :me="me" />
    <InvitePanel v-else-if="tab === 'invites'" :editable="editable" />
    <LogPanel v-else ref="logPanel" />

    <ConfirmDialog
      ref="cleanupDialog"
      v-model:open="cleanupOpen"
      title="清理失效邀请码"
      :message="CLEANUP_MESSAGE"
      confirm-text="执行清理"
      :busy="cleanupBusy"
      @confirm="runCleanup"
    />
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: 1240px;
  margin: 0 auto;
  padding: var(--sp-6) var(--sp-5) var(--sp-8);
}

.admin__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
  padding-bottom: var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.admin__tabs {
  display: flex;
  gap: var(--sp-2);
}

.tab {
  padding: var(--sp-2) var(--sp-4);
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--text-dim);
  font-size: var(--fs-sm);
  transition: color var(--t-base) var(--ease), background var(--t-base) var(--ease),
    border-color var(--t-base) var(--ease);
}
.tab:hover {
  color: var(--text);
  background: var(--surface);
}
.tab.is-on {
  color: var(--accent-text);
  border-color: var(--accent-soft);
  background: var(--accent-dim);
}

.admin__tools {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.admin__warn {
  margin: 0;
}

/* 编辑模式开关 */
.switch {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
  user-select: none;
}
.switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch__track {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: var(--r-pill);
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  transition: background var(--t-base) var(--ease), border-color var(--t-base) var(--ease);
}
.switch__dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-faint);
  transition: transform var(--t-base) var(--ease), background var(--t-base) var(--ease);
}
.switch input:checked + .switch__track {
  background: var(--accent-dim);
  border-color: var(--accent-soft);
}
.switch input:checked + .switch__track .switch__dot {
  transform: translateX(16px);
  background: var(--accent);
}
.switch input:focus-visible + .switch__track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.switch__label {
  font-size: var(--fs-xs);
  color: var(--text-dim);
}

@media (max-width: 720px) {
  .admin {
    padding: var(--sp-5) var(--sp-4) var(--sp-7);
  }
  .admin__top {
    align-items: flex-start;
  }
}
</style>
