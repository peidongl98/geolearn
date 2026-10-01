/**
 * 知识树加载器 —— 构建期在 Node 里跑，只给 .astro 页面用。
 *
 * ⚠️ 不要在任何 Vue 岛（客户端代码）里 import 本文件：它用了 node:fs。
 *    岛需要的数据请由 .astro 页面读好后，作为 props 传进去。
 *
 * 目录约定（加一章 = 加一个目录）：
 *   src/knowledge/manifest.json          章节顺序清单
 *   src/knowledge/chapter-XX/index.md    frontmatter = 章节元数据 + sections 列表
 *   src/knowledge/chapter-XX/<model>.json 每节的渲染器配置 { type, config, dataSource }
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * 知识树根目录。
 * ⚠️ 不能用 import.meta.url 推导：构建时本文件会被打进 dist/.prerender/chunks/，
 *    相对路径就失效了。astro build 的工作目录一定是项目根，所以以 cwd 为准。
 */
const KNOWLEDGE_ROOT =
  process.env.GEOLEARN_KNOWLEDGE_DIR ?? path.join(process.cwd(), 'src', 'knowledge');

function readJson(absPath) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`[knowledge] 缺少文件：${absPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    throw new Error(`[knowledge] JSON 解析失败：${absPath}\n${err.message}`);
  }
}

/** 规范化为带前导斜杠、带尾斜杠的站点路径 */
function toHref(...parts) {
  return '/' + parts.filter(Boolean).join('/') + '/';
}

/** 读取指定章节目录 */
function readChapter(dirName) {
  const dir = path.join(KNOWLEDGE_ROOT, dirName);
  const mdPath = path.join(dir, 'index.md');
  if (!fs.existsSync(mdPath)) {
    throw new Error(`[knowledge] 章节 ${dirName} 缺少 index.md`);
  }

  const { data: meta, content } = matter(fs.readFileSync(mdPath, 'utf8'));

  if (!meta.slug || !meta.title) {
    throw new Error(`[knowledge] ${dirName}/index.md 的 frontmatter 必须包含 slug 与 title`);
  }

  const sections = (meta.sections ?? []).map((s) => {
    if (!s.slug || !s.model) {
      throw new Error(`[knowledge] ${dirName}/index.md 的 section 必须同时给出 slug 与 model`);
    }
    const model = readJson(path.join(dir, s.model));
    return {
      chapterDir: dirName,
      chapterSlug: String(meta.slug),
      chapterTitle: meta.title,
      id: String(s.id ?? s.slug),
      slug: String(s.slug),
      order: Number(s.order ?? 0),
      title: s.title ?? '',
      href: toHref('chapter', meta.slug, s.slug),
      model,
    };
  });

  sections.sort((a, b) => a.order - b.order);

  return {
    dir: dirName,
    id: String(meta.id ?? meta.slug),
    slug: String(meta.slug),
    order: Number(meta.order ?? 0),
    title: meta.title,
    subtitle: meta.subtitle ?? '',
    summary: meta.summary ?? '',
    intro: content.trim(),
    href: toHref('chapter', meta.slug),
    sections,
  };
}

let cache = null;

/** 完整知识树（按 order 排序） */
export function getKnowledgeTree() {
  if (cache) return cache;
  const { chapters: dirs } = readJson(path.join(KNOWLEDGE_ROOT, 'manifest.json'));
  const chapters = dirs.map(readChapter).sort((a, b) => a.order - b.order);
  cache = { chapters };
  return cache;
}

/** 所有节，展平成一维（用于 getStaticPaths） */
export function getAllSections() {
  return getKnowledgeTree().chapters.flatMap((c) => c.sections);
}

/** 按 chapterSlug + sectionSlug 取一节 */
export function getSection(chapterSlug, sectionSlug) {
  return getAllSections().find(
    (s) => s.chapterSlug === String(chapterSlug) && s.slug === String(sectionSlug),
  );
}

/**
 * 抽屉/列表专用的精简结构：只带展示必需字段，
 * 避免把整份模型配置塞进首页 HTML。
 */
export function getOutline() {
  return getKnowledgeTree().chapters.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    sections: c.sections.map((s) => ({
      id: s.id,
      title: s.title,
      href: s.href,
    })),
  }));
}
