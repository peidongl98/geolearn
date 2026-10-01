/**
 * 自动取景 —— 把一段场景「刚好装进画面」。
 *
 * 为什么不用包围盒：太阳系是一个**盘**，它的轴对齐包围盒是一个立方体，
 * 8 个角里有 4 个落在盘外（角到中心的距离是半径的 √2 倍）。
 * 按包围盒取景会把镜头推远一倍，行星小到看不清。
 * 所以这里按**真实顶点**求取景距离。
 *
 * 做法：把所有顶点投到相机基（right / up / forward）上，
 * 对每个顶点求「要让它落在视锥内，相机至少得多远」，取最大值。
 *   |p·right| ≤ (d - p·u)·tan(halfH)   →  d ≥ |p·right|/tan(halfH) + p·u
 *   |p·up|    ≤ (d - p·u)·tan(halfV)   →  d ≥ |p·up|   /tan(halfV) + p·u
 * 其中 u 是从目标指向相机的单位向量，p 相对场景中心。
 *
 * 背景星点（userData.excludeFromBounds）不参与计算 —— 否则会被它撑爆。
 */
import * as THREE from 'three';

/** 遍历场景里的顶点，跳过标记为「背景」的对象 */
function eachVertex(root, visit) {
  root.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();

  root.traverse((obj) => {
    if (obj.userData?.excludeFromBounds) return;
    const geo = obj.geometry;
    const pos = geo?.getAttribute?.('position');
    if (!pos) return;

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      visit(v);
    }
  });
}

/**
 * @returns {{position:number[], target:number[]}|null}
 */
export function fitCameraToContent(
  root,
  { dir = [0, 0.42, 0.91], fov = 45, aspect = 1.8, margin = 1.12 } = {},
) {
  /* ---- 一圈：求场景中心 ---- */
  const box = new THREE.Box3();
  let any = false;
  eachVertex(root, (v) => {
    box.expandByPoint(v);
    any = true;
  });
  if (!any || box.isEmpty()) return null;

  const center = box.getCenter(new THREE.Vector3());

  /* ---- 相机基 ---- */
  const u = new THREE.Vector3(...dir).normalize();
  const forward = u.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  const halfV = Math.tan((fov * Math.PI) / 360);
  const halfH = halfV * Math.max(aspect, 0.2);

  /* ---- 二圈：求「刚好装下」所需的距离 ---- */
  let d = 0;
  const p = new THREE.Vector3();
  eachVertex(root, (v) => {
    p.copy(v).sub(center);
    const along = p.dot(u);
    d = Math.max(d, Math.abs(p.dot(right)) / halfH + along, Math.abs(p.dot(up)) / halfV + along);
  });

  d = Math.max(d, 0.6) * margin;

  return {
    position: center.clone().addScaledVector(u, d).toArray(),
    target: center.toArray(),
  };
}
