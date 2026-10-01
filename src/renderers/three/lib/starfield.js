/**
 * 背景星点 —— 给场景一点纵深，纯装饰。
 * 所有 scene 共用，参数化数量与半径。
 */
import * as THREE from 'three';

export function createStarfield(stage, { count = 420, radius = 32, size = 0.09 } = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // 球壳上均匀取点
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.3);
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: new THREE.Color(stage.palette.textDim),
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
}
