<script setup>
/**
 * 登录 / 注册表单 —— 两种模式共用一个组件（字段差异很小，拆开反而要维护两份）。
 * mode: 'login' | 'register'
 */
import { computed, onMounted, ref } from 'vue';
import { login, register, fetchUser } from '../../lib/session.js';
import { ApiError } from '../../lib/http.js';
import { checkUsername, checkPassword, checkInviteCode, firstError } from '../../lib/validate.js';

const props = defineProps({
  mode: { type: String, default: 'login' },
  /** 登录成功后跳回哪 —— 由 /login?next= 传入 */
  next: { type: String, default: '/' },
});

const isRegister = computed(() => props.mode === 'register');
const username = ref('');
const password = ref('');
const inviteCode = ref('');
const error = ref('');
const busy = ref(false);

/** 已经登录的话不必再看表单 */
onMounted(async () => {
  try {
    const user = await fetchUser();
    if (user) location.replace(props.next || '/');
  } catch {
    /* 查询登录态失败就照常显示表单 */
  }
});

async function submit() {
  if (busy.value) return;
  error.value = '';

  const bad = isRegister.value
    ? firstError(checkUsername(username.value), checkPassword(password.value), checkInviteCode(inviteCode.value))
    : firstError(username.value ? null : '请填写用户名', password.value ? null : '请填写密码');
  if (bad) {
    error.value = bad;
    return;
  }

  busy.value = true;
  try {
    if (isRegister.value) {
      await register(username.value.trim(), password.value, inviteCode.value.trim());
    } else {
      await login(username.value.trim(), password.value);
    }
    location.replace(props.next || '/');
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '操作失败，请重试';
    busy.value = false;
  }
}
</script>

<template>
  <form class="auth" @submit.prevent="submit">
    <header class="auth__head">
      <h1 class="auth__title">{{ isRegister ? '注册' : '登录' }}</h1>
      <p class="auth__sub">
        {{ isRegister ? '注册需要邀请码' : 'GeoLearn · 自然地理学建模学习' }}
      </p>
    </header>

    <label class="field">
      <span class="field__label">用户名</span>
      <input
        v-model="username"
        class="input"
        type="text"
        name="username"
        autocomplete="username"
        placeholder="3–20 位中英文 / 数字 / 下划线"
        :disabled="busy"
      />
    </label>

    <label class="field">
      <span class="field__label">密码</span>
      <input
        v-model="password"
        class="input"
        type="password"
        name="password"
        :autocomplete="isRegister ? 'new-password' : 'current-password'"
        placeholder="至少 8 位"
        :disabled="busy"
      />
    </label>

    <label v-if="isRegister" class="field">
      <span class="field__label">邀请码</span>
      <input
        v-model="inviteCode"
        class="input"
        type="text"
        name="inviteCode"
        autocomplete="off"
        placeholder="由管理员发放"
        :disabled="busy"
      />
      <span class="field__hint">邀请码有使用次数与有效期限制，用满即失效。</span>
    </label>

    <p v-if="error" class="alert alert--error auth__error">{{ error }}</p>

    <button class="btn btn--primary btn--block auth__submit" type="submit" :disabled="busy">
      {{ busy ? '处理中…' : isRegister ? '注册并进入' : '登录' }}
    </button>

    <p class="auth__switch">
      <template v-if="isRegister">
        已有账号？<a href="/login">去登录</a>
      </template>
      <template v-else>
        有邀请码？<a href="/register">去注册</a>
      </template>
    </p>
  </form>
</template>

<style scoped>
.auth {
  width: 100%;
  max-width: 380px;
}

.auth__head {
  margin-bottom: var(--sp-6);
}
.auth__title {
  font-size: var(--fs-xl);
}
.auth__sub {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-sm);
  color: var(--text-dim);
}

.auth__error {
  margin: 0 0 var(--sp-4);
}

.auth__submit {
  margin-top: var(--sp-2);
}

.auth__switch {
  margin: var(--sp-5) 0 0;
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--text-dim);
}
</style>
