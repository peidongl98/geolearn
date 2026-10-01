<script setup>
/** 日志表格 —— 操作日志与登录记录共用一张表，靠 mode 切列。 */
import { formatDateTime } from '../../lib/format.js';

defineProps({
  /** 'audit' | 'login' */
  mode: { type: String, default: 'audit' },
  rows: { type: Array, default: () => [] },
});

const AUDIT_LABELS = {
  'user.register': '用户注册',
  'user.create': '新增用户',
  'user.rename': '修改用户名',
  'user.resetPassword': '重置密码',
  'user.setDisabled': '禁用/启用',
  'user.setAdmin': '调整管理员权限',
  'user.delete': '删除用户',
  'invite.create': '生成邀请码',
  'invite.expire': '手动失效邀请码',
  'invite.update': '修改邀请码',
  'invite.delete': '删除邀请码',
  'system.cleanup': '清理失效邀请码',
};

const actionLabel = (a) => AUDIT_LABELS[a] ?? a;
</script>

<template>
  <div class="table-scroll">
    <table class="table">
      <thead v-if="mode === 'audit'">
        <tr>
          <th>时间</th>
          <th>操作人</th>
          <th>操作</th>
          <th>对象</th>
          <th>详情</th>
        </tr>
      </thead>
      <thead v-else>
        <tr>
          <th>时间</th>
          <th>用户名</th>
          <th>结果</th>
          <th>IP</th>
          <th>设备</th>
        </tr>
      </thead>

      <tbody v-if="mode === 'audit'">
        <tr v-for="row in rows" :key="row.id">
          <td class="num">{{ formatDateTime(row.created_at) }}</td>
          <td>{{ row.admin_name }}</td>
          <td>{{ actionLabel(row.action) }}</td>
          <td class="num dim">{{ row.target_type ? `${row.target_type}:${row.target_id ?? '—'}` : '—' }}</td>
          <td class="dim">{{ row.detail || '—' }}</td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="row in rows" :key="row.id">
          <td class="num">{{ formatDateTime(row.created_at) }}</td>
          <td>{{ row.username || '—' }}</td>
          <td>
            <span class="badge" :class="row.success ? 'badge--on' : 'badge--danger'">
              {{ row.success ? '成功' : '失败' }}
            </span>
          </td>
          <td class="num dim">{{ row.ip || '—' }}</td>
          <td class="dim ua">{{ row.user_agent || '—' }}</td>
        </tr>
      </tbody>
    </table>

    <p v-if="!rows.length" class="empty">暂无记录</p>
  </div>
</template>

<style scoped>
.dim {
  color: var(--text-dim);
}
.ua {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
