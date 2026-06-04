# Filmavo 画布引擎迁移计划:tldraw → React Flow

> 目标:2 个月内把底层引擎从 tldraw(商业 license 即将到期)换成 React Flow(MIT,永久免费),同时按 TapNow 思路精简卡片(13 种 → 3 种)。
> 分支:`feature/reactflow`,全程不动 master,filmavo/boluolab 生产零影响。

---

## 一、为什么迁移(决策已定)

| 动机 | 说明 |
|---|---|
| **省钱** | tldraw 4.x 商业 license 2 个月后到期,续费贵。React Flow MIT 协议永久免费商用。 |
| **减重** | 现有卡片极重:CustomCard 4468 行、page.tsx 3287 行、SeedanceCard 1071 行,共 16797 行。 |
| **性能** | React Flow `onlyRenderVisibleElements` 虚拟化,已验证 700 节点不卡(TapNow 同款机制)。 |

**引擎验证结论(spike 已完成):** React Flow 12.10.2 + 三节点 + 连接 + 弹窗 + 700 节点,本地实测流畅。选型成立。

---

## 二、现状盘点(已摸清)

### 13 种卡片(tldraw shape)
audio-card / camera-control-card / custom-card / gem-step0~4-card / image-card / media-upload-card / prompt-optimizer-card / seedance-card / shot-card / step2-card

### 生成 API(后端路由,全部保留不动)
`/api/image/generate`、`/api/video/generate`、`/api/seedance/{generate,query}`、`/api/kling/generate`、`/api/audio/generate`、`/api/gem/*`(7个)、`/api/chat`、`/api/optimize-prompt`、`/api/templates/*`、`/api/upload-proxy`

### 连接系统(tldraw 专属,要重写)
- `ConnectionBindingUtil.tsx`(247行):用 `getBindingsFromShape` / `fromId` / `toId` 管理绑定
- `ConnectionShapeUtil.tsx`(323行):连接线渲染
- `PortTool.tsx`(219行):拖拽连接工具

### 存档系统(格式要转换)
- 现在:`getSnapshot/loadSnapshot` → tldraw store 格式 → 存 Supabase `canvases` 表 + `workflow_templates.snapshot_json`
- 新版:React Flow `{nodes, edges, viewport}` JSON

---

## 三、新架构(TapNow 换皮模式)— 已定方案

### 策略:13 种卡片全保留,不合并,只「换皮」
- 卡片种类、生成逻辑、API 调用 **全部保留不动**
- 只做一件事:**把卡片里的参数/按钮收进弹窗(底部 prompt 栏 + 顶部工具栏)**
- 卡片身体缩小成干净的媒体框(TapNow 样式)
- **逐张卡搬到 React Flow,搬时顺手换皮**,改坏只影响一张卡
- 合并(13→5)以后再说,本期不做

### 换皮三件套(每张卡统一)
```
卡片身体     = 干净媒体框(图/视频/文本 + 状态)
底部 prompt 栏 = 选中卡片时浮现:模型 + 参数标签 + 输入框 + 发送
顶部工具栏    = 选中卡片时浮现:裁剪/下载/特效(NodeToolbar 原生)
```

### 为什么这样最稳
- ✅ license 解决(React Flow 免费)
- ✅ 性能解决(虚拟化)
- ✅ 样式变 TapNow(换皮)
- ✅ 风险最低(逻辑不动,只挪参数 UI 位置)

### 参数全隐藏(点击才出现)
- 选中节点 → **底部 prompt 栏**(模型 + 参数标签 + 输入框 + 发送)← TapNow 截图主交互
- 选中节点 → **顶部工具栏**(裁剪/下载/特效)← React Flow `NodeToolbar` 原生
- `+` 连接 → "引用该节点生成"菜单

### 技术栈
| 层 | 技术 | 状态 |
|---|---|---|
| 引擎 | @xyflow/react 12.10.2 | ✅ 已装 |
| 状态 | Zustand | ✅ 已装 |
| 节点 | 3 个 Custom Node | ⏳ spike 版已有雏形 |
| 连接传参 | `useNodeConnections` + `useNodesData` | ⏳ |
| 性能 | `onlyRenderVisibleElements` + memo + IntersectionObserver | ✅ spike 已验证 |

---

## 四、哪些复制 / 重写 / 重接

| 模块 | 处理方式 | 风险 | 说明 |
|---|---|---|---|
| 后端 API 路由(`app/api/*`) | **不动** | 🟢 无 | 完全复用 |
| AI 调用逻辑(fetch/轮询) | **复制** | 🟢 低 | 从卡片内部移到 prompt 栏触发,代码本身不改 |
| 卡片视觉 UI | **重写** | 🟢 低 | 全新 3 节点,不背历史包袱 |
| 连接 UI(画线/端口) | **重写** | 🟢 低 | React Flow 原生 Handle+Edge,比 tldraw 简单 |
| 连接业务含义(图→视频传参) | **重接** | 🟡 中 | 用 useNodeConnections 重新接,逐条理清规则 |
| 存档格式 | **写转换器** | 🟡 中 | migrateSnapshot():旧 tldraw → 新 RF JSON,71卡模板做用例 |
| 会员/支付/积分逻辑 | **复制** | 🟢 低 | 与引擎无关 |

---

## 五、8 周排期

| 周 | 目标 | 产出 |
|---|---|---|
| **W1** | 引擎骨架 + 图片节点 | spike 升级为真节点,接 `/api/image/generate` 真实生成 |
| **W2** | 视频 + 文本节点 | 接 seedance/kling/chat,三节点全部真实可生成 |
| **W3** | 连接系统 | Handle 连接 + useNodeConnections 传参(图→视频首帧) |
| **W4** | 底部 prompt 栏 + 顶部工具栏 | TapNow 主交互;模型/画质选择器 |
| **W5** | 存档迁移 | migrateSnapshot 转换器 + Supabase 读写;71卡模板验证 |
| **W6** | 性能优化 + 撤销重做 | 缩略图分级、视口卸载、高性能模式、undo/redo |
| **W7** | 灰度上线 | `/canvas-v2` 接入真实路由;Vercel 预览给内测 |
| **W8** | 全量切换 | canvas-v2 → canvas;删 tldraw 依赖;license 到期前完工 |

---

## 六、风险与对策

| 风险 | 对策 |
|---|---|
| 老用户画布打不开(存档格式变) | W5 专做迁移转换器,71卡模板做测试用例,双写过渡 |
| 连接传参规则遗漏 | W3 把每种连接的业务含义列成表,逐条实现验证 |
| 13→3 合并丢功能 | gem 系列(故事板)逻辑复杂,可能需保留为"文本节点的特殊模式",不强行合并 |
| 撤销重做 React Flow 无原生 | W6 用 zustand 历史栈方案 |
| 2 个月不够 | MVP 先砍:对齐参考线、3D多角度、HD增强 等高级功能延后 |

---

## 七、MVP 边界(2 个月必须 vs 延后)

**必须(到期前):**
- ✅ 3 节点真实生成(图/视频/文本)
- ✅ 连接 + 传参(图生视频)
- ✅ 底部 prompt 栏 + 模型选择
- ✅ 存档读档 + 模板加载 + 数据迁移
- ✅ 会员/支付/积分(复制)
- ✅ 700 节点性能

**延后(上线后迭代):**
- ⏸ 多角度 3D、图片编辑器、HD 增强、3D 世界
- ⏸ 对齐参考线、复杂撤销重做
- ⏸ gem 故事板的完整复刻(先保留简化版)

---

## 八、关键文件清单

**新建(feature/reactflow):**
```
app/canvas-v2/
  page.tsx          ← 画布主页(spike 版已有)
  store.ts          ← Zustand(已有)
  CardNode.tsx      ← 统一节点(已有,待拆成3个真节点)
  ContextPanel.tsx  ← 参数面板(已有,待改成底部 prompt 栏)
  mockData.ts       ← 假数据(迁移完成后删)
  nodes/            ← 待建:ImageNode/VideoNode/TextNode
  PromptBar.tsx     ← 待建:底部 prompt 栏
  migrate.ts        ← 待建:存档转换器
```

**复用(不动):**
```
app/api/*           ← 所有后端路由
lib/*               ← 会员/支付/storage 等
```

**最终删除(W8):**
```
app/canvas/         ← 老 tldraw 画布(全部)
package.json 里的 tldraw 依赖 + NEXT_PUBLIC_TLDRAW_LICENSE_KEY
```

---

## 九、下一步

W1 第一步:把 spike 的图片节点接上 `/api/image/generate` 真实生成,验证"调用逻辑搬运"这条路通不通。这一步通了,后面 7 周都是重复劳动。
