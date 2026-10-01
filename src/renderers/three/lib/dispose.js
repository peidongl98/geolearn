/**
 * 释放一段 Object3D 子树占用的 GPU 资源。
 * 场景切换（例如 1.1 从银河系换到太阳系）时必须调用，否则每切一次泄漏一份。
 */
export function disposeObject3D(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const m = obj.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
  });
}
