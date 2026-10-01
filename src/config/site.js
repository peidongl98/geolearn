/**
 * 站点常量 —— 全站唯一的文案/品牌来源。
 * 改标题、改站点名只改这里。
 */
export const SITE = {
  name: 'GeoLearn',
  nameCn: '地理建模学习',
  title: 'GeoLearn · 自然地理学建模学习',
  description: '把自然地理知识点做成可交互的 3D 模型，辅助学习。',
  lang: 'zh-CN',
};

/** 本地存储键名 —— 集中管理，避免各处硬编码字符串拼错 */
export const STORAGE_KEYS = {
  /** 上次选择的章节（首页抽屉默认高亮用，非鉴权用途） */
  lastSection: 'geolearn:last-section',
};
