/**
 * 极简事件总线 —— 岛与岛之间只通过事件通信，互相不 import。
 * 这样改一个岛的内部实现，不会牵动另一个岛。
 *
 * 用法：
 *   import { on, emit, EVT } from '../lib/bus.js';
 *   const off = on(EVT.LOAD_START, (payload) => {...});
 *   emit(EVT.LOAD_START, { title, href });
 */

export const EVT = {
  /** 请求打开章节抽屉（首页按钮/键盘可用） */
  DRAWER_OPEN: 'geo:drawer-open',

  /** 请求播放读条并跳转：{ title, href } */
  LOAD_START: 'geo:load-start',
};

function target() {
  return typeof window === 'undefined' ? null : window;
}

export function emit(name, detail) {
  const t = target();
  if (!t) return;
  t.dispatchEvent(new CustomEvent(name, { detail }));
}

/** @returns {() => void} 取消订阅 */
export function on(name, handler) {
  const t = target();
  if (!t) return () => {};
  const wrapped = (e) => handler(e.detail);
  t.addEventListener(name, wrapped);
  return () => t.removeEventListener(name, wrapped);
}
