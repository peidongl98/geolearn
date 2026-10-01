<script setup>
/**
 * 邀请码管理面板。
 * 规则在服务端：创建时设最大次数 + 有效期；用满 / 到期 / 手动 → expired；
 * 失效满 7 天由「清理」按钮物理删除（关联用户留痕保留）。
 */
import { onMounted, ref } from 'vue';
import { api, ApiError } from '../../lib/http.js';
import { formatDate, formatDateTime, formatExpiry, formatRelative } from '../../lib/format.js';
import ConfirmDialog from './ConfirmDialog.vue';
import PanelDialog from './PanelDialog.vue';
import Pager from './Pager.vue';
import LogTable from './LogTable.vue';

const props = defineProps({
  editable: { type: Boolean, default: false },
});

const PAGE_SIZE = 20;

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const statusFilter = ref('all');
const loading = ref(false);
const error = ref('');
const notice = ref('');

const dialog = ref({ open: false, title: '', message: '', fields: [], confirmText: '确认', danger: false });
const dialogRef = ref(null);
const busy = ref(false);
let pending = null;

const usesDialog = ref({ open: false, title: '关联用户', subtitle: '', rows: [], loading: false });

const msg = (e) => (e instanceof ApiError ? e.message : '操作失败，请重试');

const STATUS_LABEL = { active: '有效', expired: '已失效' };
const STATUS_CLASS = { active: 'badge--on', expired: 'badge--off' };

/* ------------------------------------------------------------------ 取数 */

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.admin.listInvites({
      status: statusFilter.value === 'all' ? '' : statusFilter.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    });
    rows.value = res.invites ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = msg(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function changePage(p) {
  page.value = p;
  load();
}

function changeFilter() {
  page.value = 1;
  load();
}

/* ------------------------------------------------------------------ 弹窗 */

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

/* ------------------------------------------------------------------ 操作 */

function createInvite() {
  ask({
    title: '生成邀请码',
    message: '邀请码为 8 位，已排除易混字符（0/O/1/I/L）。',
    confirmText: '生成',
    fields: [
      { key: 'maxUses', label: '最大使用次数', type: 'number', value: '1', min: 1, max: 9999 },
      {
        key: 'validDays',
        label: '有效期（天）',
        type: 'number',
        value: '30',
        min: 0,
        hint: '填 0 表示永不过期。',
      },
    ],
    run: async (v, setErr) => {
      const maxUses = Number(v.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 9999) {
        setErr('最大次数需为 1–9999 的整数');
        return false;
      }
      const res = await api.admin.createInvite({ maxUses, validDays: Number(v.validDays) });
      notice.value = `已生成邀请码：${res.code}`;
      return true;
    },
  });
}

function updateInvite(row) {
  ask({
    title: '修改邀请码',
    message: `邀请码 ${row.code}（已使用 ${row.used_count} 次）`,
    confirmText: '保存',
    fields: [
      { key: 'maxUses', label: '最大使用次数', type: 'number', value: String(row.max_uses), min: 1, max: 9999 },
      {
        key: 'validDays',
        label: '有效期（天）',
        type: 'number',
        value: '',
        min: 0,
        hint: '留空表示不修改到期时间；填 0 表示改成永不过期。',
      },
    ],
    run: async (v, setErr) => {
      const maxUses = Number(v.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 9999) {
        setErr('最大次数需为 1–9999 的整数');
        return false;
      }
      const payload = { code: row.code, action: 'update', maxUses };
      if (String(v.validDays).trim() !== '') payload.validDays = Number(v.validDays);
      await api.admin.updateInvite(payload);
      notice.value = `已更新邀请码 ${row.code}`;
      return true;
    },
  });
}

function expireInvite(row) {
  ask({
    title: '手动失效',
    message: `失效后 ${row.code} 立即无法用于注册。已注册的账号不受影响。`,
    confirmText: '失效',
    danger: true,
    run: async () => {
      await api.admin.updateInvite({ code: row.code, action: 'expire' });
      notice.value = `邀请码 ${row.code} 已失效`;
      return true;
    },
  });
}

function removeInvite(row) {
  ask({
    title: '删除邀请码',
    message: `将删除 ${row.code}（不可恢复）。\n使用记录会保留作为注册留痕。`,
    confirmText: '删除',
    danger: true,
    run: async () => {
      await api.admin.deleteInvite(row.code);
      notice.value = `已删除 ${row.code}`;
      return true;
    },
  });
}

async function showUses(row) {
  usesDialog.value = {
    open: true,
    title: '关联用户',
    subtitle: `邀请码 ${row.code}`,
    rows: [],
    loading: true,
  };
  try {
    const res = await api.admin.listLogs({ type: 'invite-uses', code: row.code });
    usesDialog.value.rows = res.logs ?? [];
  } catch (e) {
    error.value = msg(e);
  } finally {
    usesDialog.value.loading = false;
  }
}
</script>

<template>
  <section class="panel">
    <header class="panel__bar">
      <div class="panel__filter">
        <label class="field field--inline">
          <span class="field__label">状态</span>
          <select v-model="statusFilter" class="input" :disabled="loading" @change="changeFilter">
            <option value="all">全部</option>
            <option value="active">有效</option>
            <option value="expired">已失效</option>
          </select>
        </label>
      </div>
      <button class="btn btn--primary" type="button" :disabled="!editable" @click="createInvite">
        生成邀请码
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
              <th>邀请码</th>
              <th>使用</th>
              <th>有效期</th>
              <th>状态</th>
              <th>创建</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.code">
              <td class="num code">{{ row.code }}</td>
              <td class="num">{{ row.used_count }} / {{ row.max_uses }}</td>
              <td class="num dim">{{ formatExpiry(row.expires_at) }}</td>
              <td>
                <span class="badge" :class="STATUS_CLASS[row.status] ?? 'badge--off'">
                  {{ STATUS_LABEL[row.status] ?? row.status }}
                </span>
                <span v-if="row.status === 'expired' && row.expired_at" class="dim expired">
                  {{ formatDate(row.expired_at) }}
                </span>
              </td>
              <td class="dim">
                {{ row.created_by_name || '系统' }}
                <br />
                <span class="num">{{ formatDateTime(row.created_at) }}</span>
              </td>
              <td class="actions">
                <button class="btn btn--sm btn--ghost" type="button" @click="showUses(row)">关联</button>
                <button class="btn btn--sm" type="button" :disabled="!editable" @click="updateInvite(row)">
                  修改
                </button>
                <button
                  class="btn btn--sm"
                  type="button"
                  :disabled="!editable || row.status !== 'active'"
                  @click="expireInvite(row)"
                >
                  失效
                </button>
                <button
                  class="btn btn--sm btn--danger"
                  type="button"
                  :disabled="!editable"
                  @click="removeInvite(row)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="!rows.length && !loading" class="empty">还没有邀请码</p>
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
      v-model:open="usesDialog.open"
      :title="usesDialog.title"
      :subtitle="usesDialog.subtitle"
    >
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>注册时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usesDialog.rows" :key="row.id">
              <td>{{ row.username }}</td>
              <td class="num dim">{{ formatRelative(row.used_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="usesDialog.loading" class="empty">加载中…</p>
        <p v-else-if="!usesDialog.rows.length" class="empty">这个邀请码还没有被使用</p>
      </div>
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
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.field--inline {
  margin: 0;
  min-width: 160px;
}
.field--inline .input {
  min-height: 38px;
}
.panel__readonly,
.panel__msg {
  margin: 0;
}
.panel__readonly {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}
.code {
  letter-spacing: 0.06em;
  color: var(--text);
}
.dim {
  color: var(--text-dim);
}
.expired {
  margin-left: var(--sp-2);
  font-size: var(--fs-xs);
}
</style>
