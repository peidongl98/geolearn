/**
 * 调色板 —— 从 tokens.css 读实际生效的 CSS 变量，3D 世界不另立一套颜色。
 * 想换配色只改 src/config/tokens.css，3D 场景自动跟随。
 *
 * 本文件不 import three，保持纯数据。
 */

const FALLBACK = {
  bg: '#0a0e14',
  accent: '#5ba88c',
  accentSoft: '#3d6f5d',
  text: '#e8e8e8',
  textDim: '#8a8f98',
  model: ['#6f8fa8', '#7f9e88', '#9a8fa8'],
};

export function readPalette() {
  if (typeof document === 'undefined') {
    return { ...FALLBACK, model: [...FALLBACK.model] };
  }
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;

  const model = ['--model-1', '--model-2', '--model-3'].map((n, i) => v(n, FALLBACK.model[i]));

  return {
    bg: v('--bg', FALLBACK.bg),
    accent: v('--accent', FALLBACK.accent),
    accentSoft: v('--accent-soft', FALLBACK.accentSoft),
    text: v('--text', FALLBACK.text),
    textDim: v('--text-dim', FALLBACK.textDim),
    textFaint: v('--text-faint', FALLBACK.textDim),
    model,
  };
}
