<script setup>
/**
 * 顶栏右侧的用户区：用户名 / 管理台入口 / 注销。
 * 只做这一件事，页面版式由 SiteHeader.astro 负责。
 */
import { onMounted, ref } from 'vue';
import { ensureLoggedIn, logout } from '../../lib/session.js';

const user = ref(null);
const busy = ref(false);

onMounted(async () => {
  try {
    user.value = await ensureLoggedIn();
  } catch {
    /* 查询失败就当作未登录，交给服务端守卫处理 */
  }
});

async function doLogout() {
  if (busy.value) return;
  busy.value = true;
  await logout();
  location.replace('/login');
}
</script>

<template>
  <div class="um">
    <span v-if="user" class="um__name">{{ user.username }}</span>
    <a v-if="user?.isAdmin" class="um__link" href="/admin">管理台</a>
    <button class="um__link um__link--btn" type="button" :disabled="busy" @click="doLogout">
      注销
    </button>
  </div>
</template>

<style scoped>
.um {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  font-size: var(--fs-sm);
}
.um__name {
  color: var(--text-dim);
}
.um__link {
  color: var(--text-dim);
  text-decoration: none;
  background: none;
  border: 0;
  padding: 0;
}
.um__link:hover {
  color: var(--text);
  text-decoration: none;
}
.um__link--btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
