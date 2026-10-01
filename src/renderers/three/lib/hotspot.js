/**
 * 可点击光点 —— 「一个亮点 + 一圈朝向相机的光环」。
 *
 * 3D 里只画标记，真正的点击区由 Vue 侧用 stage.projectToScreen() 贴上去的
 * HTML 按钮承担：这样可点击、可聚焦、可加 aria-label，也更好排版。
 */
import * as THREE from 'three';

export function createHotspotMarker(stage, position) {
  const { palette } = stage;
  const group = new THREE.Group();
  group.position.set(...position);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.text) }),
  );
  group.add(dot);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.32, 40),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  group.add(ring);

  return {
    group,
    position,
    update(t, camera) {
      // 光环始终正对相机
      ring.quaternion.copy(camera.quaternion);
      const pulse = 1 + Math.sin(t * 2.1) * 0.16;
      ring.scale.setScalar(pulse);
      ring.material.opacity = 0.85 - (pulse - 0.84) * 1.6;
    },
  };
}
