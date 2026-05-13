# 工作流模板系统实施计划

## 背景

为 aura-canvas 添加可复用工作流模板系统。管理员账号 **1825221780@qq.com** 在自己的画布里完成工作流后，把当前画布保存为模板；首页显示所有公开模板，普通用户点击"使用模板"，系统把模板快照复制到用户自己的画布，不会修改原模板。

**封面方案（TapNow 风格）**：静态封面图（从画布自动导出）+ 管理员手动上传一段短 mp4，首页卡片默认显示封面图，鼠标 hover 时自动播放 mp4 循环。

## 关键约束

- **只有管理员 1825221780@qq.com 能"保存为模板"**（前端 UI 按邮箱隐藏，后端 API 按邮箱校验）
- 首页模板列表查询 **不拉 `snapshot_json`**（字段很大），仅在"使用模板"时拉
- 首页用 Next.js `revalidate` ISR 缓存（300 秒），不影响性能
- 封面图用 Next.js `<Image>` 懒加载
- 模板系统与现有画布保存逻辑（canvas-storage.ts / api/canvas/save）**解耦**，走独立表和 API
- 卡片默认最小化状态保存（已由 `isMinimized` props 保证）

---

## Phase 0：文档发现（已完成）

### 已确认 API 清单

#### tldraw 4.3.1（来源：node_modules 的 .d.ts）

| API | 签名 | 用途 |
|---|---|---|
| `getSnapshot(store)` | 从 `'tldraw'` 导入 | 获取快照，已在 `app/canvas/page.tsx:1718/1840/2208` 使用 |
| `loadSnapshot(store, snapshot)` | 从 `'tldraw'` 导入 | 加载快照，已在 `app/canvas/page.tsx:1816/2135` 使用 |
| `editor.toImage(shapes, opts)` | 返回 `Promise<{blob, width, height}>` | 导出画布缩略图（来源：`@tldraw/editor/dist-cjs/index.d.ts:3764`）|
| `editor.getCurrentPageShapeIds()` | 返回当前页所有 shape ID | 配合 `toImage` 使用 |
| `TLImageExportOptions` | `{format, scale, background, padding, darkMode, pixelRatio, bounds}` | 导出参数（来源：同 .d.ts:7384）|

#### 不存在的 API（别用）

- `exportToBlob()` — tldraw 2.x 旧版，4.x 已并入 `editor.toImage`
- `editor.exportAsBlob()` — 不存在
- 顶层 `exportAs(editor, ids, opts)` 会触发**浏览器下载**，不适合生成封面图

#### 项目现有模式

| 模式 | 位置 |
|---|---|
| Supabase 浏览器客户端 | `lib/supabase/client.ts:createClient()` |
| Supabase 服务端（service role） | 直接 `createClient(url, SERVICE_ROLE_KEY)`，见 `app/api/canvas/save/route.ts` |
| 拿登录用户 | `const { data: { user } } = await supabase.auth.getUser()`（见 `app/canvas/page.tsx:1789`）|
| 资源上传 | `canvas-storage.ts:uploadAsset(userId, blob, ext)` → `'assets'` bucket，路径 `${userId}/${Date.now()}.${ext}` |
| 首页插入点 | `app/page.tsx:589`（Pricing Section 之前）|
| 首页卡片风格 | `glass-card p-8 hover:border-blue-500/30 transition-all duration-300` |
| 首页进画布链接 | `<Link href="/canvas">`（Next.js `<Link>`）|

### 管理员校验方案

- 前端：`app/canvas/page.tsx` 在拿到 user 后判断 `user.email === '1825221780@qq.com'`，符合才显示"保存为模板"按钮
- 后端：`app/api/templates/save/route.ts` 拿 session 后同样校验 email，否则 403

---

## Phase 1：数据库与 Storage 准备

### 1.1 新建 SQL 迁移文件

**路径**：`docs/workflow_templates.sql`（新文件）

**内容**：
```sql
create table if not exists workflow_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,              -- 静态封面图（自动从画布导出的 jpg）
  preview_video_url text,      -- hover 自动播放的短 mp4（管理员手动上传）
  snapshot_json jsonb not null,
  category text,
  tags text[] default '{}',
  is_public boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- 预留未来字段
  parent_template_id uuid references workflow_templates(id), -- remix 用
  version int default 1,                                      -- 版本控制用
  is_featured boolean default false,                          -- 精选用
  use_count int default 0                                     -- 使用次数统计
);

create index if not exists idx_templates_public_category on workflow_templates(is_public, category) where is_public = true;
create index if not exists idx_templates_featured on workflow_templates(is_featured) where is_featured = true;
create index if not exists idx_templates_created_at on workflow_templates(created_at desc);

-- RLS（行级安全）
alter table workflow_templates enable row level security;

-- 任何人都能读公开模板
create policy "public templates readable by all"
  on workflow_templates for select
  using (is_public = true);

-- 创建者能读自己的所有模板
create policy "creators read own templates"
  on workflow_templates for select
  using (auth.uid() = created_by);

-- 只有创建者能改自己的
create policy "creators update own templates"
  on workflow_templates for update
  using (auth.uid() = created_by);

create policy "creators delete own templates"
  on workflow_templates for delete
  using (auth.uid() = created_by);

-- 写入走服务端（service role 绕过 RLS），所以不需要 insert policy
```

### 1.2 在 Supabase Dashboard 执行

- 用户手动在 Supabase SQL Editor 里跑一次
- 同时确认 `assets` bucket 已存在（已存在）——模板封面就存在 `assets/templates/{timestamp}.jpg` 路径下

### 验证清单

- [ ] `docs/workflow_templates.sql` 文件创建
- [ ] Supabase 里 `select count(*) from workflow_templates;` 返回 0 说明表创建成功
- [ ] `select polname from pg_policies where tablename = 'workflow_templates';` 能看到 4 条 policy

### 反模式警告

- ❌ 不要在 `docs/schema.sql` 里改，单独建文件方便后续迁移跟踪
- ❌ 别加 `on delete cascade` 到 `created_by` —— 管理员账号删除时不应该删掉所有模板

---

## Phase 2：模板 API 路由（后端）

### 2.1 `app/api/templates/save/route.ts`（新文件）

**职责**：管理员保存模板

**请求**：
```ts
POST /api/templates/save
Content-Type: multipart/form-data
Fields: {
  title: string,
  description?: string,
  category?: string,
  tags?: string,           // 逗号分隔
  coverBase64: string,     // 前端 toImage 拿到的 blob 转 base64（jpg）
  previewVideo: File,      // 管理员上传的短 mp4（必填，建议 3-8 秒）
  snapshot: string,        // JSON.stringify(getSnapshot(editor.store))
}
```

**逻辑**（抄 `app/api/canvas/save/route.ts` 的服务端 client 初始化模式）：
1. 用 SSR client 读 cookie 拿 session，验证 `user.email === '1825221780@qq.com'`，否则 403
2. 拿 user.id
3. 把 `coverBase64` 转 Blob，用 service_role client 上传到 `assets/templates/covers/{timestamp}.jpg`，拿 publicUrl
4. 把 `previewVideo` 直接上传到 `assets/templates/videos/{timestamp}.mp4`，拿 publicUrl
5. `insert into workflow_templates (title, description, cover_url, preview_video_url, snapshot_json, category, tags, created_by, is_public) values (...)`
6. 返回 `{ success: true, id: template.id }`

**注意**：用 FormData 而不是 JSON（因为要传 mp4 文件，base64 太大）

**关键代码片段（文件顶部）**：
```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = '1825221780@qq.com';
```

### 2.2 `app/api/templates/list/route.ts`（新文件）

**职责**：给首页提供模板列表（不含 snapshot）

**请求**：`GET /api/templates/list?category=xxx&limit=20`

**逻辑**：
1. 用 service role client（public 读即可，不需要 session）
2. `select id, title, description, cover_url, preview_video_url, category, tags, is_featured, created_at from workflow_templates where is_public = true order by is_featured desc, created_at desc limit 20`
3. 返回 `{ templates: [...] }`

**注意**：**SELECT 里绝对不能有 `snapshot_json`**

### 2.3 `app/api/templates/[id]/route.ts`（新文件）

**职责**：用户点"使用模板"时拉完整 snapshot

**请求**：`GET /api/templates/{id}`

**逻辑**：
1. 拿登录用户（用户必须登录才能使用模板）
2. `select * from workflow_templates where id = :id and is_public = true`
3. 可选：`update workflow_templates set use_count = use_count + 1 where id = :id`
4. 返回完整模板对象

### 验证清单

- [ ] 用 curl 或 Postman 测 `POST /api/templates/save`，非管理员账号返回 403
- [ ] 管理员账号保存后，数据库能看到新记录，Storage 里有新封面图
- [ ] `GET /api/templates/list` 返回的 JSON 里**没有 snapshot_json 字段**
- [ ] `GET /api/templates/{id}` 返回完整数据

### 反模式警告

- ❌ 不要把 ADMIN_EMAIL 硬编码在前端代码里——前端只做 UI 显隐，真正校验必须在后端
- ❌ list 接口不要用 `select *`

---

## Phase 3：画布内"保存为模板"按钮（前端）

### 3.1 在 `app/canvas/page.tsx` 新增状态和 UI

**位置**：在顶部工具栏区域（和"保存"按钮同一行），只在 `user.email === '1825221780@qq.com'` 时渲染

**需要的状态**：
```ts
const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
const [isAdmin, setIsAdmin] = useState(false);

// 在拿到 user 之后：
setIsAdmin(user?.email === '1825221780@qq.com');
```

**按钮**：
```tsx
{isAdmin && (
  <button
    onClick={() => setShowSaveTemplateModal(true)}
    className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs border border-purple-500/30"
  >
    保存为模板
  </button>
)}
```

### 3.2 新建 `app/canvas/SaveTemplateModal.tsx`（新文件）

**职责**：弹窗采集标题/描述/分类/标签，生成封面图，调 API

**核心逻辑**：
```tsx
import { Editor, getSnapshot } from 'tldraw';

export function SaveTemplateModal({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('通用');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. 导出封面图
      const shapeIds = editor.getCurrentPageShapeIds();
      const { blob } = await editor.toImage([...shapeIds], {
        format: 'jpeg',
        scale: 0.5,
        background: true,
        padding: 32,
        darkMode: true,
      });
      const coverBase64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(blob);
      });

      // 2. 拿 snapshot
      const snapshot = getSnapshot(editor.store);

      // 3. 调 API
      const res = await fetch('/api/templates/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          tags: tagsInput.split(',').map(s => s.trim()).filter(Boolean),
          coverBase64,
          snapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      alert('模板保存成功');
      onClose();
    } catch (e: any) {
      alert('保存失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      {/* 表单 UI */}
    </div>
  );
}
```

**UI 表单字段**：标题（必填）、描述（textarea）、分类（下拉：通用/视频/图像/音频/创作）、标签（逗号分隔）、预览封面图缩略图

### 验证清单

- [ ] 非管理员账号登录，画布里看不到"保存为模板"按钮
- [ ] 管理员账号点击按钮，弹窗出现
- [ ] 填写信息后点保存，浏览器 Network 能看到 `POST /api/templates/save` 成功
- [ ] 数据库里能看到新记录，封面图在 Storage 里能打开

### 反模式警告

- ❌ `editor.toImage` 必须等 `await`，别忘了 `Promise<{blob}>` 的 destructure
- ❌ 别传完整 TLShape 数组给 `toImage`，传 `TLShapeId[]`

---

## Phase 4：首页模板画廊（前端）

### 4.1 新建 `app/_components/TemplateGallery.tsx`（服务端组件）

**路径**：`app/_components/TemplateGallery.tsx`

**职责**：服务端预取模板列表，渲染大卡片网格，带 ISR

```tsx
import Link from 'next/link';
import Image from 'next/image';

export const revalidate = 300; // 5 分钟 ISR

async function fetchTemplates() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/templates/list`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.templates || [];
}

export async function TemplateGallery() {
  const templates = await fetchTemplates();
  if (templates.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-3">创意工作流模板</h2>
          <p className="text-zinc-400">一键复用完整工作流，立即开始创作</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t: any) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ template }: { template: any }) {
  return (
    <div className="glass-card overflow-hidden group hover:border-purple-500/40 transition-all">
      <div className="relative aspect-[16/9] bg-zinc-900 overflow-hidden">
        {template.cover_url && (
          <Image
            src={template.cover_url}
            alt={template.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2">{template.title}</h3>
        <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{template.description}</p>
        <div className="flex flex-wrap gap-1 mb-4">
          {(template.tags || []).slice(0, 3).map((tag: string) => (
            <span key={tag} className="px-2 py-0.5 text-xs rounded bg-white/5 text-zinc-300">
              {tag}
            </span>
          ))}
        </div>
        <Link
          href={`/canvas?templateId=${template.id}`}
          className="inline-block w-full text-center px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 transition text-sm font-medium"
        >
          使用模板
        </Link>
      </div>
    </div>
  );
}
```

### 4.2 在 `app/page.tsx` 中嵌入

**挑战**：`app/page.tsx` 第 1 行是 `'use client'`，无法直接放服务端组件。两个方案：

**方案 A（推荐）**：保留 page.tsx 为客户端组件，TemplateGallery 也做成客户端组件，用 `useEffect` fetch，fetch 走 `/api/templates/list`（该接口本身已做缓存）

**方案 B**：把 TemplateGallery 提取到独立的服务端组件文件中，在 page.tsx 里通过 `<TemplateGallery />` 引入。Next.js 15 允许服务端组件作为 props 传入客户端组件的 children——但不支持直接嵌套。所以还是需要把相关逻辑调整。

**选择方案 A（简单可行）**：
```tsx
// 在 app/page.tsx 约 589 行（Pricing Section 之前）插入：
<TemplateGallery />
```
组件内用 `useEffect` 拉列表 + 缓存时间戳，避免每次刷新重拉。

### 验证清单

- [ ] 首页新加的 section 在 Pricing 之前、CTA 之后显示
- [ ] 浏览器 Network 可见 `/api/templates/list` 被调用，返回 JSON 无 `snapshot_json` 字段
- [ ] 封面图在开发者工具的 Network 面板里用 `loading="lazy"`
- [ ] Lighthouse 跑一下首页性能分数，和改动前对比不掉

### 反模式警告

- ❌ 别把 list API 的返回数据（含所有模板 snapshot）全部渲染到页面 HTML 里——只渲染 title/cover/tags
- ❌ `next/image` 如果用 Supabase Storage 的域名，需要在 `next.config.js` 的 `images.remotePatterns` 里加白名单，否则 build 报错

### Next.js Image 白名单

**修改 `next.config.js`**：
```js
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
```

---

## Phase 5：使用模板加载逻辑（前端）

### 5.1 修改 `app/canvas/page.tsx`

**逻辑**：
1. 组件挂载时（拿到 editor 之后），读 `searchParams` 里的 `templateId`
2. 如果有，调 `/api/templates/{id}`，拿 `snapshot_json`
3. **关键**：为当前用户创建一个**新画布**（不覆盖默认画布），然后 `loadSnapshot(editor.store, snapshot)` 加载进去
4. 加载完跳转到 URL 不带 templateId 的状态（`router.replace('/canvas')`），避免刷新又重复加载

**代码框架**（加在现有的 editor mount 回调之后）：
```ts
import { useSearchParams, useRouter } from 'next/navigation';

const searchParams = useSearchParams();
const router = useRouter();
const templateId = searchParams.get('templateId');

useEffect(() => {
  if (!editorInstance || !templateId || !userId) return;
  (async () => {
    // 1. 拉模板
    const res = await fetch(`/api/templates/${templateId}`);
    const data = await res.json();
    if (!data.template) return;

    // 2. 创建新画布给当前用户（复用现有 getOrCreateCanvas 的模式，但这里是 create new）
    // 调用一个新 API：POST /api/canvas/create-from-template
    //   服务端：insert into canvases (user_id, title) values (...); insert into canvas_snapshots (canvas_id, snapshot)
    const createRes = await fetch('/api/canvas/create-from-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title: `${data.template.title}（副本）`,
        snapshot: data.template.snapshot_json,
      }),
    });
    const { canvasId } = await createRes.json();

    // 3. 加载到 editor
    loadSnapshot(editorInstance.store, data.template.snapshot_json);

    // 4. 清掉 URL 参数
    router.replace('/canvas');
  })();
}, [editorInstance, templateId, userId]);
```

### 5.2 新建 `app/api/canvas/create-from-template/route.ts`（新文件）

**请求**：
```
POST /api/canvas/create-from-template
Body: { userId, title, snapshot }
```

**逻辑**：
1. 用 service role client
2. `insert into canvases (user_id, title) returning id`
3. `insert into canvas_snapshots (canvas_id, snapshot) values (...)`
4. 返回 `{ canvasId }`

### 验证清单

- [ ] 从首页点"使用模板"，跳转到 `/canvas?templateId=xxx`
- [ ] 画布加载后，看到模板内容出现
- [ ] URL 自动清理为 `/canvas`
- [ ] 左侧"我的画布"列表里多了一个"xxx（副本）"
- [ ] 在新画布里修改、保存，**刷新首页再次点击模板，看到的还是原始模板**（没被污染）

### 反模式警告

- ❌ **千万不能**直接在当前默认画布上 `loadSnapshot`——会覆盖用户自己的工作
- ❌ 不要在 URL 参数里带 snapshot_json（太大），只带 id
- ❌ `useEffect` 的依赖数组要完整，防止 templateId 变化时不重载

---

## Phase 6：最终验证

### 6.1 端到端测试清单

**管理员侧（1825221780@qq.com）**：
- [ ] 登录后画布右上角有"保存为模板"按钮
- [ ] 在画布摆几个最小化卡片（text/image/video），点击保存
- [ ] 填标题"AI 分镜工作流"、描述、分类"视频"、标签"分镜,AI,Kling"
- [ ] 保存成功，数据库可查到
- [ ] 非管理员账号登录画布，**看不到**按钮

**用户侧**：
- [ ] 首页滚到 Pricing 之前，看到"创意工作流模板"section
- [ ] 看到刚才保存的"AI 分镜工作流"卡片，有封面图、标题、描述、标签
- [ ] 点"使用模板"，跳 `/canvas?templateId=xxx`
- [ ] 画布加载出相同内容
- [ ] 左侧画布列表多了"AI 分镜工作流（副本）"
- [ ] 在副本里改东西，保存
- [ ] 刷新首页再点一次模板，打开的是新的原始副本，不是被改过的那个

**反模式检查（grep）**：
- [ ] `grep -n "select \*" app/api/templates/list/route.ts` 应该没有匹配
- [ ] `grep -n "snapshot_json" app/api/templates/list/route.ts` 应该没有匹配
- [ ] `grep -n "ADMIN_EMAIL" app/canvas/page.tsx` 应该没有（硬编码邮箱只在后端）

**性能检查**：
- [ ] 浏览器 DevTools Network 面板，首页 `/api/templates/list` 响应 < 200KB
- [ ] 封面图带 `loading="lazy"`（Network 面板 Initiator 可看）
- [ ] Lighthouse 性能分数和改动前持平或更高

### 6.2 已知风险和回滚方案

**风险 1**：Next.js Image 加载 Supabase URL 报错
- **表现**：build 时报 `Invalid src prop` 错误
- **修复**：在 `next.config.js` 的 `images.remotePatterns` 加 `*.supabase.co`

**风险 2**：`editor.toImage` 在大画布导出太慢
- **表现**：保存模板时 UI 卡 5+ 秒
- **修复**：`scale: 0.3` 进一步降分辨率；或限制 `bounds` 只导出可视区域

**风险 3**：模板 snapshot 里含 base64 图片，数据库超 JSONB 单行限制（1GB，实际编辑慢）
- **表现**：保存成功但读取慢
- **修复**：保存模板前，把 snapshot 里的 base64 图片上传到 Storage，替换成 URL（参考现有 `mirrorUrlToStorage` 模式）

**回滚**：
- 数据：`drop table workflow_templates;`
- Storage：`assets/templates/` 目录可手动清理
- 代码：4 个新 API 路由 + 2 个组件 + 1 个 modal 文件可整体删除，`app/page.tsx` 和 `app/canvas/page.tsx` 的修改用 git revert

---

## 阶段依赖图

```
Phase 0（已完成）
  ↓
Phase 1（数据库） ← 前置
  ↓
Phase 2（API） ← 依赖 Phase 1
  ↓         ↓
Phase 3（保存按钮）  Phase 4（首页画廊） ← 都依赖 Phase 2
  ↓
Phase 5（使用模板加载）  ← 依赖 Phase 2, 3, 4
  ↓
Phase 6（验证）
```

Phase 3 和 Phase 4 可并行。
