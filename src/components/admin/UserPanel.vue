<script setup>
/**
 * 用户管理面板。
 * 每个行级操作都是「准备一份弹窗描述 + 一个执行函数」，统一交给 ConfirmDialog。
 * 编辑模式关闭时，所有写操作入口禁用（只读）。
 */
import { onMounted, ref } from 'vue';
import { api, ApiError } from '../../lib/http.js';
import { formatDateTime, formatRelative } from '../../lib/format.js';
import { checkUsername, checkPassword, firstError } from '../../lib/validate.js';
import ConfirmDialog from './ConfirmDialog.vue';
import PanelDialog from './PanelDialog.vue';
import Pager from './Pager.vue';
import LogTable from './LogTable.vue';

const props = defineProps({
  editable: { type: Boolean, default: false },
  /** 当前登录的管理员，用于禁止自锁操作 */
  me: { type: Object, default: null },
});

const PAGE_SIZE = 20;

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const query = ref('');
const loading = ref(false);
const error = ref('');
const notice = ref('');

const dialog = ref({ open: false, title: '', message: '', fields: [], confirmText: '确认', danger: false });
const dialogRef = ref(null);
const busy = ref(false);
let pending = null;

const logDialog = ref({ open: false, title: '', subtitle: '', rows: [], loading: false });

const msg = (e) => (e instanceof ApiError ? e.message : '操作失败，请重试');

/* ------------------------------------------------------------------ 取数 */

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.admin.listUsers({ q: query.value, page: page.value, pageSize: PAGE_SIZE });
    rows.value = res.users ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = msg(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function search() {
  page.value = 1;
  load();
}

function changePage(p) {
  page.value = p;
  load();
}

/* ------------------------------------------------------ 弹窗调度 */

function ask(spec) {
  notice.value = '';
  error.value = '';
  pending = spec.run;
  dialog.value = {
    open: true,
    title: spec.title,
    message: spec.message ?? '',
    fields: spec.fields ?? [],
    confirmText: spec.confirmText ?? '确认',
    danger: !!spec.danger,
  };
}

async function onConfirm(values) {
  const run = pending;
  if (!run) return;
  busy.value = true;
  try {
    const done = await run(values, (m) => dialogRef.value?.setError(m));
    if (done) {
      dialog.value.open = false;
      pending = null;
      await load();
    }
  } catch (e) {
    dialogRef.value?.setError(msg(e));
  } finally {
    busy.value = false;
  }
}

const isSelf = (row) => props.me && row.id === props.me.id;

/* ------------------------------------------------------------------ 操作 */

function createUser() {
  ask({
    title: '新增用户',
    message: '直接创建账号，不消耗邀请码。',
    confirmText: '创建',
    fields: [
      { key: 'username', label: '用户名', placeholder: '3–20 位中英文 / 数字 / 下划线' },
      { key: 'password', label: '初始密码', type: 'password', placeholder: '至少 8 位' },
      {
        key: 'isAdmin',
        label: '角色',
        options: [
          { value: '0', label: '普通用户' },
          { value: '1', label: '管理员' },
        ],
      },
    ],
    run: async (v, setErr) => {
      const bad = firstError(checkUsername(v.username), checkPassword(v.password));
      if (bad) {
        setErr(bad);
        return false;
      }
      await api.admin.createUser({
        username: v.username.trim(),
        password: v.password,
        isAdmin: v.isAdmin === '1',
      });
      notice.value = `已创建用户 ${v.username.trim()}`;
      return true;
    },
  });
}

function renameUser(row) {
  ask({
    title: '修改用户名',
    message: `当前：${row.username}`,
    confirmText: '保存',
    fields: [{ key: 'username', label: '新用户名', value: row.username }],
    run: async (v, setErr) => {
      const bad = checkUsername(v.username);
      if (bad) {
        setErr(bad);
        return false;
      }
      await api.admin.updateUser({ id: row.id, action: 'rename', value: v.username.trim() });
      notice.value = `已改名为 ${v.username.trim()}`;
      return true;
    },
  });
}

function resetPassword(row) {
  ask({
    title: '重置密码',
    message: `将重置 ${row.username} 的密码，并踢掉该账号全部设备的登录态。`,
    confirmText: '重置',
    fields: [{ key: 'password', label: '新密码', type: 'password', placeholder: '至少 8 位' }],
    run: async (v, setErr) => {
      const bad = checkPassword(v.password);
      if (bad) {
        setErr(bad);
        return false;
      }
      await api.admin.updateUser({ id: row.id, action: 'resetPassword', value: v.password });
      notice.value = `已重置 ${row.username} 的密码`;
      return true;
    },
  });
}

function toggleDisabled(row) {
  const disable = !row.disabled;
  ask({
    title: disable ? '禁用账号' : '启用账号',
    message: disable
      ? `禁用后 ${row.username} 立刻无法登录，已登录的设备会被踢下线。`
      : `启用后 ${row.username} 可以重新登录。`,
    confirmText: disable ? '禁用' : '启用',
    danger: disable,
    run: async (v, setErr) => {
      await api.admin.updateUser({ id: row.id, action: 'setDisabled', value: disable });
      notice.value = `${row.username} 已${disable ? '禁用' : '启用'}`;
      return true;
    },
  });
}

function toggleAdmin(row) {
  const grant = !row.is_admin;
  ask({
    title: grant ? '设为管理员' : '取消管理员',
    message: grant
      ? `${row.username} 将获得管理台全部权限。`
      : `${row.username} 将失去管理台访问权限。`,
    confirmText: grant ? '设为管理员' : '取消管理员',
    danger: !grant,
    run: async () => {
      await api.admin.updateUser({ id: row.id, action: 'setAdmin', value: grant });
      notice.value = `${row.username} 已${grant ? '设为管理员' : '取消管理员'}`;
      return true;
    },
  });
}

function removeUser(row) {
  ask({
    title: '删除账号',
    message: `将永久删除 ${row.username}（不可恢复）。\n登录记录与邀请码使用留痕会保留。`,
    confirmText: '删除',
    danger: true,
    run: async () => {
      await api.admin.deleteUser(row.id);
      notice.value = `已删除 ${row.username}`;
      return true;
    },
  });
}

async function showLogs(row) {
  logDialog.value = { open: true, title: '登录记录', subtitle: row.username, rows: [], loading: true };
  try {
    const res = await api.admin.listLogs({ type: 'login', userId: row.id, pageSize: 100 });
    logDialog.value.rows = res.logs ?? [];
  } catch (e) {
    error.value = msg(e);
  } finally {
    logDialog.value.loading = false;
  }
}

/** 自锁操作在前端也提前挡一层（后端仍会独立校验） */
</script>

<template>
  <section class="panel">
    <header class="panel__bar">
      <form class="panel__search" @submit.prevent="search">
        <input v-model="query" class="input" type="search" placeholder="搜索用户名" :disabled="loading" />
        <button class="btn" type="submit" :disabled="loading">搜索</button>
      </form>
      <button class="btn btn--primary" type="button" :disabled="!editable" @click="createUser">
        新增用户
      </button>
    </header>

    <p v-if="!editable" class="panel__readonly">编辑模式已关闭，当前为只读。</p>
    <p v-if="error" class="alert alert--error panel__msg">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--ok panel__msg">{{ notice }}</p>

    <div class="card card--plain">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>最后登录</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                {{ row.username }}
                <span v-if="isSelf(row)" class="badge badge--on self">我</span>
              </td>
              <td>
                <span class="badge" :class="row.is_admin ? 'badge--on' : 'badge--off'">
                  {{ row.is_admin ? '管理员' : '普通' }}
                </span>
              </td>
              <td>
                <span class="badge" :class="row.disabled ? 'badge--danger' : 'badge--off'">
                  {{ row.disabled ? '已禁用' : '正常' }}
                </span>
              </td>
              <td class="num dim">{{ formatDateTime(row.created_at) }}</td>
              <td class="num dim">{{ row.last_login_at ? formatRelative(row.last_login_at) : '从未登录' }}</td>
              <td class="actions">
                <button class="btn btn--sm btn--ghost" type="button" @click="showLogs(row)">记录</button>
                <button class="btn btn--sm" type="button" :disabled="!editable" @click="renameUser(row)">
                  改名
                </button>
                <button class="btn btn--sm" type="button" :disabled="!editable" @click="resetPassword(row)">
                  改密
                </button>
                <button
                  class="btn btn--sm"
                  type="button"
                  :disabled="!editable || isSelf(row)"
                  @click="toggleDisabled(row)"
                >
                  {{ row.disabled ? '启用' : '禁用' }}
                </button>
                <button
                  class="btn btn--sm"
                  type="button"
                  :disabled="!editable || isSelf(row)"
                  @click="toggleAdmin(row)"
                >
                  {{ row.is_admin ? '降权' : '提权' }}
                </button>
                <button
                  class="btn btn--sm btn--danger"
                  type="button"
                  :disabled="!editable || isSelf(row)"
                  @click="removeUser(row)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="!rows.length && !loading" class="empty">没有匹配的用户</p>
        <p v-if="loading" class="empty">加载中…</p>
      </div>

      <Pager :page="page" :page-size="PAGE_SIZE" :total="total" :disabled="loading" @update:page="changePage" />
    </div>

    <ConfirmDialog
      ref="dialogRef"
      v-model:open="dialog.open"
      :title="dialog.title"
      :message="dialog.message"
      :fields="dialog.fields"
      :confirm-text="dialog.confirmText"
      :danger="dialog.danger"
      :busy="busy"
      @confirm="onConfirm"
    />

    <PanelDialog
      v-model:open="logDialog.open"
      :title="logDialog.title"
      :subtitle="logDialog.subtitle"
      wide
    >
      <p v-if="logDialog.loading" class="empty">加载中…</p>
      <LogTable v-else mode="login" :rows="logDialog.rows" />
    </PanelDialog>
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
.panel__search {
  display: flex;
  gap: var(--sp-2);
  flex: 1;
  min-width: 220px;
}
.panel__search .input {
  max-width: 280px;
}
.panel__readonly,
.panel__msg {
  margin: 0;
}
.panel__readonly {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
.self {
  margin-left: var(--sp-2);
}
.dim {
  color: var(--text-dim);
}
</style>
