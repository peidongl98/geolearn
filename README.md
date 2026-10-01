# GeoLearn · 自然地理学建模学习工具

把自然地理知识点做成可交互的 3D 模型，辅助学习。**不做区域地理，只做自然地理。**

- 技术栈：Astro（纯静态输出）+ Vue 岛 + Three.js + Cloudflare Pages / D1 / Functions
- 视觉：科技简约 + 低多边形 3D，深色底（`#0a0e14`）+ 低饱和强调色（暗青绿 `#5ba88c`）

---

## 一、目录结构

```
GeoLearn/
├── astro.config.mjs          构建配置（非必要不动）
├── wrangler.toml             Pages 项目 + D1 绑定
├── db/schema.sql             D1 建表语句
├── scripts/                  一次性运维脚本
│
├── functions/                ★ Cloudflare Pages Functions（后端全部在这里）
│   ├── _middleware.js        守卫：未登录拿不到受保护页面
│   └── api/
│       ├── _lib/             后端共享库（http / crypto / session / guard / audit / validate）
│       ├── register.js  login.js  logout.js  session.js
│       └── admin/            users.js  invites.js  logs.js  cleanup.js
│
├── src/
│   ├── config/               ★ 三个「单一来源」
│   │   ├── tokens.css        颜色 / 圆角 / 字号 / 动效时长（唯一配色来源）
│   │   ├── api.js            接口路径（唯一路由来源）
│   │   └── site.js           站点名称与文案
│   ├── styles/               global.css（底座）+ ui.css（共享 UI 原语）
│   ├── lib/                  前端纯工具：bus 事件总线 / http / session / validate / format / knowledge
│   ├── knowledge/            ★ 知识树内容（每章一个目录）
│   ├── renderers/            ★ 3D 渲染层
│   │   ├── ModelHost.astro   渲染器接口的落地点（type + scene → 组件）
│   │   └── three/
│   │       ├── lib/          stage / palette / matte / hotspot / starfield / dispose / useStage
│   │       ├── builders/     ★ 场景构件注册表 + 每个构件一个文件
│   │       ├── SpaceZoom.vue      1.1 探索式导航
│   │       ├── EarthRotation.vue  1.2 自转
│   │       └── HomeStage.vue      首页随机几何体
│   ├── components/           岛：home / auth / admin / chapter / layout
│   ├── layouts/              BaseLayout / AuthShell
│   └── pages/                页面路由
└── dist/                     构建产物（gitignore）
```

### 三条硬约束（改代码前先读）

1. **颜色只写在 `src/config/tokens.css`**。组件、3D 场景都不许写死色值；3D 侧通过
   `renderers/three/lib/palette.js` 读 CSS 变量。
2. **接口路径只写在 `src/config/api.js`**。前端所有请求走 `src/lib/http.js` 的 `api.*`。
3. **知识树内容只写在 `src/knowledge/`**。页面路由、首页抽屉都由它自动生成。

---

## 二、常见改动怎么做

### 加一节（例如 1.3）

1. 在 `src/knowledge/chapter-01/` 放一个 `1.3.json`：

   ```json
   {
     "id": "1.3",
     "type": "three-3d",
     "config": { "scene": "spin-sphere", "body": "spin-sphere" },
     "dataSource": "《自然地理学》第 X 版 P??"
   }
   ```

2. 在 `chapter-01/index.md` 的 `sections` 里加一项（`slug` 决定网址 `/chapter/1/1-3/`）。

> 不需要新建任何页面文件、不需要改任何组件。

### 加一章

1. 新建 `src/knowledge/chapter-02/index.md`（frontmatter 照抄第一章，改 id / slug / title / sections）。
2. 在 `src/knowledge/manifest.json` 的 `chapters` 数组里加 `"chapter-02"`。

### 加一种 3D 构件（场景里的一段内容）

1. 抄 `src/renderers/three/builders/spinSphere.js` 起一个新文件，导出
   `build(stage, cfg) => { group, update?(t, dt, camera) }`。
2. 在 `src/renderers/three/builders/index.js` 的 `BUILDERS` 里注册一个名字。
3. 章节 JSON 里的 `body` 写这个名字。

### 加一种渲染器（新的大类别，如 canvas 模拟）

1. 在 `src/renderers/` 下写组件。
2. 在 `src/renderers/ModelHost.astro` 里 `import` + 加一行 `key === '...' && <Comp client:only="vue" ... />`。
   （必须显式分支，Astro 的 `client:only` 不支持动态组件标签。）

---

## 三、开发与部署

```bash
npm install
npm run dev            # 本地开发（Astro dev server，含 Pages Functions 需用 wrangler pages dev）
npm run build          # 产出 dist/
```

部署（Direct Upload，本机已验证路径）：

```bash
# 1) 构建
npm run build

# 2) 带上 Cloudflare 凭证后发布（凭证见工作区 .deploy-secrets）
export CLOUDFLARE_API_TOKEN=<CLOUDFLARE_Page_TOKEN>
export CLOUDFLARE_ACCOUNT_ID=<CLOUDFLARE_ACCOUNT_ID>
npx wrangler pages deploy        # 读 wrangler.toml 的 pages_build_output_dir = "dist"
```

> `functions/` 由 Pages 从**项目根**自动识别，**不要**复制进 `dist/`，
> 也不要在 `wrangler.toml` 里写 `account_id`（Pages 会报错）。

本地联调（含 D1 与 Functions）：

```bash
npx wrangler pages dev dist --d1=DB
# 本地库建表
npx wrangler d1 execute geolearn-db --local --file=db/schema.sql
```

---

## 四、守卫系统

- 路由级守卫在 `functions/_middleware.js`：`/`、`/chapter/**`、`/admin/**` 需要登录，
  `/admin/**` 还需要 `is_admin = 1`。Pages Functions 的根中间件运行在静态资源之前，
  所以未登录**根本拿不到页面 HTML**，不是「先给页面再前端跳转」。
- 登录态：`gl_session` Cookie（HttpOnly + Secure + SameSite=Lax，30 天），
  服务端 `sessions` 表存的是 token 的 SHA-256，不存 token 本身；剩余不足 20 天自动续期。
- 密码：PBKDF2-SHA256，存储格式 `pbkdf2$sha256$<iter>$<salt>$<hash>`，
  **自描述**——日后调高迭代次数不影响老账号登录。迭代次数见
  `functions/api/_lib/crypto.js`（Workers Free 档单请求 CPU 上限 10ms，不敢开太大）。
- 邀请码：`max_uses` + `expires_at`，用满或到期转 `expired` 并记 `expired_at`；
  失效满 7 天由 `/api/admin/cleanup` 物理删除。已注册账户不受影响，永久保留。

### 管理员账号

按约定，管理员账号由使用者指定后写入 D1，**不通过注册流程产生**：

```bash
node scripts/create-admin.mjs <用户名> <密码>          # 本地库
node scripts/create-admin.mjs <用户名> <密码> --remote # 线上库
```

---

## 五、内容正确性（硬约束）

- 每个模型 JSON **必须**有 `dataSource` 字段；没有就写
  `"占位几何体 · 非科学模型（本批为骨架版本，未接入任何数值）"`。
- 数值参数必须能追到出处（教材页码 / 权威链接），并在 `dataSource` 里写明。
- 拿不准就停下来问，**不猜**。有争议的内容标「存在争议」，不放进模型。
