/**
 * 贴图注册表 —— 3D 用到的图片资源集中在这里，顺带把**来源**记在旁边。
 *
 * 为什么单独列一张表：
 *   模型 JSON 的 dataSource 记的是「知识点依据哪本教材」，
 *   贴图的版权/出处是另一条线，必须自己也查得到。
 *   换贴图、加贴图只改这个文件。
 *
 * 已用素材与许可：
 *   earth-day  地球海陆冰 2048×1024 等距圆柱投影
 *              来源：NASA Blue Marble（Land_ocean_ice_2048）
 *              许可：公有领域（NASA 影像不受版权保护）
 *              文件页：https://commons.wikimedia.org/wiki/File:Land_ocean_ice_2048.jpg
 *
 * 约定：贴图路径带版本号后缀（earth-day.jpg），要换图就换文件名，
 *       并在 public/_headers 里给 /textures/* 的长缓存兜底。
 */
import * as THREE from 'three';

const REGISTRY = {
  'earth-day': '/textures/earth-day.jpg',
};

const cache = new Map();

/**
 * 取一张贴图（带缓存）。
 * TextureLoader 会**立即**返回 Texture 对象，图片加载完自动生效，
 * 所以调用方不需要写 await，可以直接拿去建材质。
 *
 * @param {string} name 注册表里的键，例如 'earth-day'
 * @returns {THREE.Texture|null}
 */
export function getTexture(name) {
  if (!name) return null;
  const url = REGISTRY[name];
  if (!url) {
    console.warn(`[textures] 未注册的贴图：${name}（可选：${Object.keys(REGISTRY).join(', ')}）`);
    return null;
  }
  if (cache.has(name)) return cache.get(name);

  const tex = new THREE.TextureLoader().load(url);
  // 照片类贴图必须声明为 sRGB，否则颜色会发灰
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(name, tex);
  return tex;
}
