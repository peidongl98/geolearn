/**
 * 站点常量 —— 全站唯一的文案/品牌来源。
 * 改站名、改标题只改这里。
 */
export const SITE = {
  /** 英文代号：仓库名 / 目录名 / 版权署名用 */
  name: 'GeoLearn',
  /** 中文站名：界面上给人看的就是这个 */
  nameCn: '地理模型教具',
  title: 'GeoLearn · 地理模型教具',
  description: '把自然地理知识点做成可交互的 3D 模型教具，用于教学与自学。',
  lang: 'zh-CN',
};

/** 本地存储键名 —— 集中管理，避免各处硬编码字符串拼错 */
export const STORAGE_KEYS = {
  /** 上次选择的章节（首页抽屉默认高亮用，非鉴权用途） */
  lastSection: 'geolearn:last-section',
};
