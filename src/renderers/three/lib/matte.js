/**
 * 统一材质 —— 全站 3D 物体的默认外观：低多边形 + 哑光，不用高光金属。
 * 换风格只改这里。
 */
import * as THREE from 'three';

export function matteMaterial(color, { emissive = null, emissiveIntensity = 0, opacity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    flatShading: true,
    roughness: 0.85,
    metalness: 0,
    emissive: new THREE.Color(emissive ?? '#000000'),
    emissiveIntensity,
    transparent: opacity < 1,
    opacity,
  });
}

/** 自发光小球（恒星、光点核心） */
export function glowMaterial(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: Math.min(1, intensity),
  });
}
