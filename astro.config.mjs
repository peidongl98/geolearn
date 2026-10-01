// Astro 配置 —— 改动本文件会影响全站构建，非必要不动。
// 项目架构说明见 README.md
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  site: 'https://geolearn.pages.dev',

  // 纯静态输出：页面在构建期生成，守卫由 functions/_middleware.js 在网络边缘完成
  output: 'static',

  integrations: [vue()],

  build: {
    // 目录式输出：/chapter/1/1-1/ 而不是 /chapter/1/1-1.html
    format: 'directory',
  },

  vite: {
    ssr: {
      // three 必须在构建期被打进 bundle，否则 SSR 阶段会 require 失败
      noExternal: ['three'],
    },
  },
});
