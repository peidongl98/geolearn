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

/**
 * 带贴图的球体材质 —— 用于「要看起来像真的」的天体（目前只有地球）。
 *
 * 与低多边形占位物的区别：
 *   - flatShading = false（有贴图再分面会把海陆切碎）
 *   - 把同一张贴图当作 emissiveMap 低强度自发光，
 *     这样背光面的海陆轮廓还不至于全黑，看得清 —— 教具的可用性优先于「真实夜半球」。
 */
export function texturedMaterial(texture, { roughness = 0.85, nightGlow = 0.14 } = {}) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: nightGlow,
    flatShading: false,
    roughness,
    metalness: 0,
  });
}
