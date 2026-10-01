<script setup>
/**
 * 章节抽屉 —— 底部中央按钮 + 上滑抽屉。
 * 只负责「选哪一节」，选完发一个 LOAD_START 事件就收工，
 * 不关心谁来播放读条（与 StageLoading 完全解耦）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { emit, on, EVT } from '../../lib/bus.js';
import { STORAGE_KEYS } from '../../config/site.js';

const props = defineProps({
  /** getOutline() 的产物：[{ id, title, subtitle, sections:[{id,title,href}] }] */
  outline: { type: Array, default: () => [] },
  /**
   * 入口形态：
   *   'floating' —— 固定屏幕底部中央（首页用）
   *   'inline'   —— 内联在文档流里（小节页放在面包屑那一行右侧用）
   */
  variant: { type: String, default: 'floating' },
  /** 当前所在小节的 href；给了就在抽屉里标「当前」 */
  current: { type: String, default: '' },
});

const open = ref(false);
const panel = ref(null);
const trigger = ref(null);

/** 章节页传 current，首页退回到「上次点过的那节」 */
const markedHref = ref(props.current || '');
onMounted(() => {
  if (markedHref.value) return;
  try {
    markedHref.value = localStorage.getItem(STORAGE_KEYS.lastSection) ?? '';
  } catch {
    /* 隐私模式下 localStorage 不可用，忽略 */
  }
});

const isInline = computed(() => props.variant === 'inline');
const markLabel = computed(() => (props.current ? '当前' : '上次'));

const flatCount = computed(() => props.outline.reduce((n, c) => n + c.sections.length, 0));

function show() {
  open.value = true;
  nextTick(() => panel.value?.focus());
}

function hide({ toTrigger = false } = {}) {
  open.value = false;
  if (toTrigger) nextTick(() => trigger.value?.focus());
}

function toggle() {
  if (open.value) hide({ toTrigger: true });
  else show();
}

function choose(section) {
  try {
    localStorage.setItem(STORAGE_KEYS.lastSection, section.href);
  } catch {
    /* ignore */
  }
  open.value = false;
  emit(EVT.LOAD_START, { title: section.title, href: section.href });
}

function onKeydown(e) {
  if (e.key === 'Escape' && open.value) hide({ toTrigger: true });
}

// 抽屉打开时锁住背景滚动
watch(open, (v) => {
  document.body.style.overflow = v ? 'hidden' : '';
});

let offOpen = null;
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  offOpen = on(EVT.DRAWER_OPEN, show);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  offOpen?.();
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="drawer-root">
    <!-- 底部中央入口 -->
    <button ref="trigger" class="drawer-trigger" :class="{ 'drawer-trigger--inline': isInline }" type="button" @click="toggle">
      <span class="drawer-trigger__icon" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      选择章节
      <span v-if="flatCount" class="drawer-trigger__count num">{{ flatCount }}</span>
    </button>

    <!-- 抽屉 -->
    <Transition name="sheet">
      <div v-if="open" class="drawer" role="dialog" aria-modal="true" aria-label="选择章节">
        <div class="drawer__scrim" @click="hide({ toTrigger: true })"></div>

        <div ref="panel" class="drawer__panel" tabindex="-1">
          <header class="drawer__head">
            <span class="drawer__grip" aria-hidden="true"></span>
            <div class="drawer__titles">
              <h2 class="drawer__title">选择章节</h2>
            </div>
            <button class="drawer__close" type="button" aria-label="关闭" @click="hide({ toTrigger: true })">
              ×
            </button>
          </header>

          <div class="drawer__body">
            <section v-for="chapter in outline" :key="chapter.id" class="chap">
              <div class="chap__head">
                <span class="chap__id num">第 {{ chapter.id }} 章</span>
                <span class="chap__name">{{ chapter.title }}</span>
                <span v-if="chapter.subtitle" class="chap__sub">{{ chapter.subtitle }}</span>
              </div>

              <ul class="chap__list">
                <li v-for="section in chapter.sections" :key="section.id">
                  <button
                    class="lesson"
                    type="button"
                    :class="{ 'is-last': section.href === markedHref }"
                    @click="choose(section)"
                  >
                    <span class="lesson__id num">{{ section.id }}</span>
                    <span class="lesson__title">{{ section.title }}</span>
                    <span v-if="section.href === markedHref" class="lesson__flag">{{ markLabel }}</span>
                    <span class="lesson__arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              </ul>
            </section>

            <p v-if="!outline.length" class="empty">知识树还是空的。</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ---- 入口按钮 ---- */
.drawer-trigger {
  position: fixed;
  left: 50%;
  bottom: calc(var(--sp-5) + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: var(--z-drawer);
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  height: 46px;
  padding: 0 var(--sp-5);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-pill);
  color: var(--text);
  font-size: var(--fs-sm);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  transition: border-color var(--t-base) var(--ease), background var(--t-base) var(--ease);
}
.drawer-trigger:hover {
  background: var(--surface-3);
  border-color: var(--accent-soft);
}

/* 内联形态：跟在面包屑那一行右边，不浮动、不投影 */
.drawer-trigger--inline {
  position: static;
  transform: none;
  height: 30px;
  padding: 0 var(--sp-3);
  font-size: var(--fs-xs);
  box-shadow: none;
}
.drawer-trigger--inline .drawer-trigger__icon i {
  width: 11px;
}
.drawer-trigger__icon {
  display: grid;
  gap: 3px;
}
.drawer-trigger__icon i {
  display: block;
  width: 14px;
  height: 1.5px;
  background: var(--accent);
  border-radius: 2px;
}
.drawer-trigger__count {
  font-size: var(--fs-xs);
  color: var(--text-faint);
  border-left: 1px solid var(--border-strong);
  padding-left: var(--sp-2);
}

/* ---- 抽屉 ---- */
.drawer {
  position: fixed;
  inset: 0;
  z-index: var(--z-drawer);
}

.drawer__scrim {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 9, 0.62);
  backdrop-filter: blur(2px);
}

.drawer__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 76svh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-top: 1px solid var(--border-strong);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  outline: none;
}

.drawer__head {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  border-bottom: 1px solid var(--border);
}
.drawer__grip {
  position: absolute;
  top: var(--sp-2);
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: var(--border-strong);
}
.drawer__titles {
  flex: 1;
}
.drawer__title {
  font-size: var(--fs-md);
}
.drawer__close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  background: transparent;
  border-radius: var(--r-sm);
  color: var(--text-dim);
  font-size: 18px;
  line-height: 1;
}
.drawer__close:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.drawer__body {
  overflow-y: auto;
  padding: var(--sp-4) var(--sp-5) calc(var(--sp-6) + env(safe-area-inset-bottom, 0px));
  overscroll-behavior: contain;
}

/* ---- 章 ---- */
.chap + .chap {
  margin-top: var(--sp-5);
}
.chap__head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-3);
}
.chap__id {
  font-size: var(--fs-xs);
  color: var(--accent-text);
  border: 1px solid var(--accent-soft);
  background: var(--accent-dim);
  border-radius: var(--r-pill);
  padding: 1px var(--sp-2);
}
.chap__name {
  font-size: var(--fs-base);
  color: var(--text);
}
.chap__sub {
  font-size: var(--fs-xs);
  color: var(--text-faint);
}

.chap__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--sp-2);
}
@media (min-width: 720px) {
  .chap__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.lesson {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  text-align: left;
  transition: border-color var(--t-base) var(--ease), background var(--t-base) var(--ease);
}
.lesson:hover {
  background: var(--surface-3);
  border-color: var(--accent-soft);
}
.lesson__id {
  font-size: var(--fs-sm);
  color: var(--accent-text);
  flex: none;
  min-width: 2.2em;
}
.lesson__title {
  flex: 1;
  font-size: var(--fs-base);
  color: var(--text);
}
.lesson__flag {
  font-size: var(--fs-xs);
  color: var(--text-faint);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-pill);
  padding: 0 var(--sp-2);
}
.lesson__arrow {
  color: var(--text-faint);
}
.lesson:hover .lesson__arrow {
  color: var(--accent-text);
}

/* ---- 进出场 ---- */
.sheet-enter-active .drawer__panel,
.sheet-leave-active .drawer__panel {
  transition: transform var(--t-slow) var(--ease-out);
}
.sheet-enter-from .drawer__panel,
.sheet-leave-to .drawer__panel {
  transform: translateY(100%);
}
.sheet-enter-active .drawer__scrim,
.sheet-leave-active .drawer__scrim {
  transition: opacity var(--t-base) var(--ease);
}
.sheet-enter-from .drawer__scrim,
.sheet-leave-to .drawer__scrim {
  opacity: 0;
}
</style>
