/**
 * Vue 侧的组合式封装 —— 把 three 舞台的生命周期挂到组件生命周期上。
 * 三个 3D 岛都复用这几个函数，避免各写一遍 mount/dispose/帧循环。
 */
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { createStage } from './stage.js';
import { getBuilder } from '../builders/index.js';
import { disposeObject3D } from './dispose.js';

/**
 * 创建并托管一个舞台。
 * @param {import('vue').Ref} containerRef
 * @param {object|Function} optsOrGetter createStage 的选项
 */
export function useStage(containerRef, optsOrGetter = {}) {
  const stage = shallowRef(null);

  onMounted(() => {
    if (!containerRef.value) return;
    const opts = typeof optsOrGetter === 'function' ? optsOrGetter() : optsOrGetter;
    stage.value = createStage(containerRef.value, opts);
    // 帧循环在这里启动：构件还没挂上去也没关系，挂上后自然出现在画面里
    stage.value.start();
  });

  onBeforeUnmount(() => {
    stage.value?.dispose();
    stage.value = null;
  });

  return stage;
}

/**
 * 在舞台就绪后构建一段场景，挂上它的 update。
 * rebuildKey 变化时会**先释放旧场景**再重建（用于 1.1 的逐级推进）。
 *
 * @param {import('vue').ShallowRef} stageRef
 * @param {Function} bodyGetter  () => builder 名称
 * @param {Function} cfgGetter   () => 传给 builder 的配置
 * @param {import('vue').Ref} rebuildKey 可选，变化即重建
 */
export function useBuilder(stageRef, bodyGetter, cfgGetter, rebuildKey = null) {
  const built = shallowRef(null);
  let stopFrame = null;

  function teardown(stage) {
    stopFrame?.();
    stopFrame = null;
    if (built.value) {
      stage?.remove(built.value.group);
      disposeObject3D(built.value.group);
      built.value = null;
    }
  }

  watch(
    rebuildKey ? [stageRef, rebuildKey] : [stageRef],
    ([stage]) => {
      teardown(stage);
      if (!stage) return;

      const build = getBuilder(bodyGetter());
      if (!build) return;

      const scene = build(stage, cfgGetter());
      stage.add(scene.group);
      if (scene.update) {
        stopFrame = stage.onFrame((t, dt, camera) => scene.update(t, dt, camera));
      }
      built.value = scene;
    },
    { immediate: true },
  );

  onBeforeUnmount(() => teardown(stageRef.value));

  return built;
}

/**
 * 让 HTML 贴片跟随 3D 坐标。
 * 每帧直接写 el.style，不经过 Vue 响应式 —— 避免每帧触发重渲染。
 */
export function useBillboards(stageRef, itemsGetter) {
  const hosts = new Map();
  let stopFrame = null;

  function register(key, el) {
    if (el) hosts.set(key, el);
    else hosts.delete(key);
  }

  watch(
    stageRef,
    (stage) => {
      stopFrame?.();
      stopFrame = null;
      if (!stage) return;

      stopFrame = stage.onFrame(() => {
        const items = itemsGetter();
        const alive = new Set();

        for (const it of items) {
          const el = hosts.get(it.key);
          if (!el) continue;
          alive.add(it.key);
          const p = stage.projectToScreen(it.position);
          el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
          el.style.opacity = p.visible ? '1' : '0';
          el.style.pointerEvents = p.visible ? 'auto' : 'none';
        }

        // 本轮没被点名的贴片一律隐藏：
        // 换场动画期间 items 为空，否则旧坐标上的标签会「留在原地」穿帮。
        for (const [key, el] of hosts) {
          if (alive.has(key)) continue;
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
      });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => stopFrame?.());

  return { register };
}
