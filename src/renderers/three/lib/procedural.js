/**
 * 程序化贴图 —— 不依赖任何外部素材，用 canvas 现画。
 *
 * 目前用于气态巨行星的**条带外观**（木星、土星的横向云带是它们最显著的特征）。
 * 好处：零素材、零许可问题、体积为零。
 * 代价：是「像」，不是实拍 —— 章节 JSON 的 dataSource 必须说明这一点。
 */
import * as THREE from 'three';

/**
 * 生成横向条带贴图（气态巨行星的云带）。
 *
 * @param {string[]} palette 条带色阶，由暗到亮给 3–5 个
 * @param {object} opts
 * @param {number} opts.bands 条带数量
 * @param {number} opts.wobble 条带边界的起伏幅度（0–1，占图高比例）
 * @param {number} opts.blur 每条带内部的细腻程度
 * @returns {THREE.CanvasTexture}
 */
export function bandedTexture(palette, { bands = 16, wobble = 0.035 } = {}) {
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, W, H);

  // 逐条带铺色：边界用两个不同频率的正弦叠出起伏，避免看起来像等宽色块
  for (let i = 0; i < bands; i++) {
    const color = palette[i % palette.length];
    const y0 = (i / bands) * H;
    const h = H / bands;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= W; x += 8) {
      const wave =
        Math.sin((x / W) * Math.PI * 2 * 2) * wobble * H +
        Math.sin((x / W) * Math.PI * 2 * 5 + i) * wobble * H * 0.5;
      ctx.lineTo(x, y0 + wave);
    }
    for (let x = W; x >= 0; x -= 8) {
      const wave =
        Math.sin((x / W) * Math.PI * 2 * 2 + 0.7) * wobble * H +
        Math.sin((x / W) * Math.PI * 2 * 5 + i + 1.3) * wobble * H * 0.5;
      ctx.lineTo(x, y0 + h + wave);
    }
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
