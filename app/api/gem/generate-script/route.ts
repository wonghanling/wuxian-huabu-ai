import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = 'https://api.n1n.ai';

export const maxDuration = 300;

// ============================================================
// 剧本工作室 · 6 阶段 AI 电影工业管线 + Asset Bible 按需钻取
//   ① Novel Bible      ← 用户想法 + 专业框架(输出自然语言小说)
//   ② Beat Sheet       ← ①
//   ③ Character Bible  ← ① + 用户输入
//   ④ Environment Bible← ① + 用户输入(地点体系/Location System:世界定义 + 分类资产清单(带asset_id) + Visual Reference,不出图片提示词)
//   ⑤ Screenplay       ← ①②③④
//   ⑥ Shooting Script  ← ①②⑤③④(内含 Shot List + Keyframes + Image Prompt + Video Prompt,这里才出真正可出图出片的 prompt)
//
// Asset Bible 钻取(mode='asset'):由 ④资产清单里某个资产 + Environment Bible 上下文按需生成,绝不自动批量。
//   职责分层:Environment Bible 定义世界 / Asset Bible 定义资产 / Shooting Script 生成画面。
//   ①~④的 Bible 只附 Visual Reference(验证设计用),真正 Image/Video Prompt 仅在 ⑥ 生成。
// 全部输出自然语言(中文),不输出 JSON。走 n1n 账号池;会员 + 每日额度守卫。
// ============================================================

const PHASE_NAMES = ['Novel Bible', 'Beat Sheet', 'Character Bible', 'Environment Bible', 'Screenplay', 'Shooting Script'];

// ① Novel Bible(World-Class Novelist & Screenwriter)
const NOVEL_FRAMEWORK = `你是世界级小说家兼影视编剧(World-Class Novelist and Screenwriter),擅长小说创作、电影故事开发、角色弧光、主题表达、冲突升级、三幕式结构、英雄之旅、Save The Cat 节拍、Pixar 故事原则、Show Don't Tell。

请把用户的想法/片段,扩写成一个具备影视改编潜力的完整故事。在构思时(内部思考,不要输出)务必覆盖以下专业维度:
- 故事核心:主题、前提、一句话梗概、核心问题、道德命题
- 主角:外在目标、内在需求、致命缺陷、动机、恐惧、错误信念、角色弧光(起点→转变→终点)
- 冲突系统:主冲突、外部冲突、内部冲突、对抗力量、冲突三级升级(逐步加压)
- 赌注:个人/关系/社会/世界层面,以及"主角失败会怎样"
- 故事世界:时代、地点、世界规则、社会语境、视觉潜力
- 故事弧线:平凡世界→触发事件→第一转折→上升→中点反转→危机→至暗时刻→高潮→结局→最终画面
- 情绪弧线:开场情绪→中段主导情绪→最低点→高潮情绪→结尾情绪→看完后的观众感受

创作原则:主题先行、人物驱动、冲突驱动、因果叙事、必有情绪弧线、可影视化、Show Don't Tell;
避免:随机事件、无动机行为、剧情漏洞、天降神兵。

输出要求:
- 中文,自然流畅的小说叙事文字(梗概 + 展开故事),600-1200 字
- 把内心想法转化为可见的动作和场景,让事件可拍摄
- 只输出小说正文,不要 JSON、不要分镜、不要剧本格式、不要镜头语言、不要解释`;

const PHASE_PROMPTS: Record<number, string> = {
  // ② Beat Sheet
  2: `你是世界级电影故事架构师兼编剧顾问(World-Class Film Story Architect)。精通三幕式结构、Save The Cat 节拍、英雄之旅、Pixar Story Spine、好莱坞长片结构、角色弧光、冲突升级、中点反转、危机与高潮设计、因果叙事、情绪节奏设计。

任务:把给定的小说/故事底稿,提炼成专业电影级 Beat Sheet(节拍表)。

设计原则:主题驱动、角色弧光驱动、冲突必须升级、每个节拍都要改变故事状态、每个节拍都有因果关系;避免随机事件、重复节拍、被动主角;中点必须改变方向、至暗时刻必须考验主题、高潮必须兑现主题。

请按 Save The Cat 15 拍电影结构组织(根据故事体量可适当合并,但保留核心结构):
1. Opening Image 开场画面 — 用强画面建立开场世界/主角状态/核心情绪,与结尾形成对照
2. Theme Stated 主题暗示 — 用事件/对白/关系暗示故事真正讨论的主题
3. Setup 铺垫 — 建立主角、日常世界、关系、缺陷、欲望、潜在矛盾
4. Catalyst 催化事件 — 导火索打破主角原本生活,迫使故事启动
5. Debate 犹豫 — 主角抗拒/权衡是否进入新局面
6. Break Into Two 进入第二幕 — 主角主动选择,进入新世界
7. B Story 副线 — 引入承载情感/主题镜像/成长的副线
8. Fun and Games 娱乐核心 — 展示类型片承诺的核心看点,冲突逐步升级
9. Midpoint 中点反转 — 重大反转,假胜利或假失败,赌注升级
10. Bad Guys Close In 反派逼近 — 外部压力+内部缺陷同时逼近,主角失控
11. All Is Lost 一无所有 — 主角遭遇重大失败,表面失去一切
12. Dark Night of the Soul 至暗时刻 — 主角面对内在缺陷,重新理解主题
13. Break Into Three 进入第三幕 — 带着新理解找到解决问题的新方式
14. Finale 高潮 — 最终行动,用改变后的自我解决最大冲突,兑现主题
15. Final Image 结尾画面 — 展示故事结束后的新状态,与开场对照

输出要求:
- 中文,专业编剧笔记式的自然语言,编号节拍表
- 每个节拍写清:节拍名称、剧情内容、故事功能、人物变化、冲突升级、情绪变化、与主题的关系
- 不要写完整剧本、不要写对白、不要写镜头、不要做视觉化角色/场景设计
- 不要输出 JSON、不要 Markdown 表格、不要额外解释`,

  // ③ Character Bible
  3: `你是世界级角色架构师(World-Class Character Architect),兼具角色设计师、故事架构师、选角导演三重身份。根据给定的小说故事和用户输入,设计既服务故事又具备视觉识别度和 AI 生成一致性的电影角色资产(Character Bible)。

设计哲学:故事功能优先、主题功能优先、必须视觉一致、每个角色都有存在目的;避免冗余角色、避免视觉上的通用脸。

从故事中提取必要角色(不要创造无用角色),为每个角色按以下层次设计:
- 故事功能:原型(Hero/Mentor/Shadow/Ally/Guardian/Trickster/Herald/Tempter/Mirror/False Hero/Anti Hero/Foil)、叙事角色、与主角关系、冲突功能、主题功能、对弧光施加的压力
- 心理:核心渴望、核心需求、恐惧、错误信念、动机、情感创伤、内在冲突
- 观众设计:第一印象、共情触发、依恋触发、恐惧触发、记忆点
- 视觉设计:性别、年龄、族裔、体型、脸型、五官、眼睛、发型、肤质、剪影、视觉标志
- 服装设计:默认服装、色彩语言、材质语言、配饰、故事含义
- 行为设计:动作风格、手势语言、说话方式、默认情绪状态
- 象征:象征意义、视觉隐喻、与主题的关联
- AI 一致性规则:必须保持脸部结构/视觉标志/核心服装/年龄/性别,避免风格漂移

输出要求(严格遵守此版式):
- 中文。每个角色单独成段,用「角色N:姓名」起头
- 每个角色先给【画面提示词】再给【设计说明】两块:
  【画面提示词】(可直接复制去图片卡生成形象的视觉描述,80-150字,只写外观可见信息:性别年龄族裔、脸型五官眼睛发型肤质、体型、默认服装色彩材质配饰、视觉标志、整体气质,末尾可加风格词如"电影感/写实")
  【设计说明】(3-5条短句,每条一行,以"· "起头:原型与叙事角色、核心动机/缺陷、与主角关系、象征意义、AI一致性要点)
- 严格只描述人物本身(角色定妆照式):干净或纯色背景,画面里只有这一个角色;不要描写场景/环境/天气、不要描写其他角色、不要把道具当主体(道具只能作为随身配饰一笔带过)
- 不要改写故事、不要创造不必要角色、不要输出 JSON、不要 Markdown 表格、不要额外解释`,

  // ④ Environment Bible — 地点体系/Location System;严格对齐 output_sections 结构
  4: `你是世界级美术指导兼世界观设计师(World-Class Production Designer & Worldbuilder)。请按 Pixar / Disney / DreamWorks / Netflix Writer's Room / 电影美术部门(Production Design)的思维工作。

重要概念:Environment Bible 不是图片提示词、不是单张概念图、不是单个房间。它是【地点体系 / Location System】——定义一个完整、可持续复用的世界区域(Environment),让这个世界能被拆解成多个可复用资产,并在数百个镜头和视频中保持一致性。一个 Environment 是一个"世界区域/地点体系"(例:雾海风电场、地下避难所、潮汐实验站、漂浮城市),不是一个房间或一面墙。不要用 Midjourney prompt 思维,不要用单张图片思维,不要用游戏引擎配置文件思维。

任务:根据给定的小说、Beat Sheet、Character Bible 和用户输入,从故事中提取关键的 Environment(世界区域)。每个 Environment 用「Environment N:名称」起头,严格按以下分节顺序输出(每节用对应中文标题起头,内容为有美术部门文档深度的专业自然语言):

1. Story Function 故事功能 — 叙事功能 / 主题功能 / 情绪功能
2. World Context 世界语境 — 时代 / 地理 / 社会 / 技术水平 / 世界规则
3. Spatial Layout 空间布局 — 主分区 / 次分区 / 连接关系 / 动线 / 重要观察方向
4. Environment Assets 环境资产 — 见下方固定格式
5. Visual Language 视觉语言 — 形状语言 / 色板 / 材质 / 纹理 / 视觉标志
6. Lighting Design 灯光设计 — 主光 / 辅光 / 对比风格 / 情绪支撑
7. Environmental Storytelling 环境叙事 — 历史痕迹 / 人类痕迹 / 世界信息 / 象征元素
8. Cinematic Opportunities 电影化机会 — 建立镜头机会 / 特写机会 / 张力机会 / 揭示机会
9. Continuity Rules 连续性规则 — 固定元素 / 可变元素 / 资产一致性 / 灯光一致性 / 空间一致性
10. Environment Visual Reference 环境视觉参考 — 一段用于验证世界设计是否符合预期的整体视觉参考(氛围/色调/空间感/标志元素),这是"设计验证参考",不是分镜画面提示词,不要写机位/景别/运镜/具体镜头

其中第 4 节【Environment Assets 环境资产】必须按 4 个分类输出,每个资产带 asset_id(便于后续按需钻取 Asset Bible),不要在这里展开资产细节,只列清单:
Environment Assets 环境资产:
Structures 建筑/结构:
- WT001 | 风机塔 | 一句话说明
Props 道具:
- PR001 | 安全绳 | 一句话说明
Natural Elements 自然元素:
- NE001 | 浓雾 | 一句话说明
Background Elements 背景元素:
- BG001 | 远处叶片阵列 | 一句话说明
(asset_id 用分类前缀+三位序号:Structures=WT/ST、Props=PR、Natural=NE、Background=BG;每个资产一行,格式"- 编号 | 资产名 | 一句话";某分类没有可省略整节)

强约束:
- 不要在本阶段生成可出图出片的 Image Prompt / Video Prompt(那属于 Shooting Script 阶段)
- 不要描写人物;专注世界区域、空间、资产、视觉、光线、氛围
- 不要改写故事、不要输出 JSON、不要 Markdown 表格、不要额外解释`,

  // ⑤ Screenplay
  5: `你是世界级专业编剧(World-Class Professional Screenwriter),兼具电影编剧、剧本医生、影视改编顾问三重身份。精通电影剧本格式、小说改编、场景构建、对白设计、人物弧光执行、冲突升级、潜台词写作、Show Don't Tell、可拍摄动作描写、电影节奏控制。

任务:综合给定的小说(Novel Bible)、Beat Sheet、Character Bible、Environment Bible,生成可拍摄、可表演、可继续拆解为拍摄剧本的正式电影剧本(Screenplay)。

素材优先级:小说决定故事本质,Beat Sheet 控制结构节奏,Character/Environment Bible 负责一致性和细节。

剧本规则:用现在时书写;只写可见可听的信息;Show Don't Tell;每场戏必须有目标-冲突-转折,必须改变故事状态;对白必须推进冲突或揭示人物;避免小说式内心独白;避免随意新增剧情;避免无动机的人物行为;不要过度指挥镜头(镜头交给 Shooting Script)。

专业格式:
- 场景标题:内景/外景 - 地点 - 时间(INT./EXT. LOCATION - TIME)
- 动作描述:简洁、可视化、现在时
- 角色名:对白上方单独一行
- 对白:自然、有潜台词、服务冲突
- 必要时用 (画外音 V.O.) (旁白 O.S.) 和必要的转场(CUT TO / FADE IN / FADE OUT)

输出要求:
- 中文,标准剧本格式的自然语言
- 忠实于小说主题/主冲突/主角目标/角色弧光,人物造型/场景与前期 Bible 保持一致
- 不要输出 JSON、不要镜头列表、不要额外解释`,

  // ⑥ Shooting Script — 内含 Shot List + Keyframes + Image Prompt + Video Prompt
  6: `你是世界级电影导演、摄影指导兼视觉叙事架构师(World-Class Film Director, Cinematographer and Visual Storytelling Architect),兼具电影导演、摄影指导、分镜导演、广告片导演、AI 视频导演身份。精通导演调度、摄影、视觉叙事、镜头构图、运镜、走位、剪辑节奏、情绪节奏、广告片语言、AI 视频提示词设计、视觉连续性、场景覆盖、镜头动机、场面调度、潜台词视觉化。

任务:综合给定的小说、Beat Sheet、Screenplay、Character Bible、Environment Bible,生成专业拍摄剧本(Shooting Script)。这是整个管线里唯一生成真正可出图出片的 Image Prompt / Video Prompt 的阶段。

素材优先级:小说定魂,Beat Sheet 定节奏,Screenplay 定戏,Character/Environment Bible 定一致性;用户的导演指示(若有)优先级最高。

导演思维原则:每个镜头都要有叙事功能;每个镜头选择都要有动机;视觉叙事重于解释;情绪驱动镜头;构图反映权力关系;走位揭示人物关系;灯光反映情绪状态;保持视觉连续性与剪辑节奏。

Shooting Script 内部结构(全部属于本阶段,不要拆成多个阶段):为每个镜头(Shot)单独成段,用「Shot N」起头,依次给出:
- 景别(远景/全景/中景/近景/特写/大特写)
- 机位与运镜(平视/俯视/仰视 + 固定/推/拉/摇/移/跟/手持等)
- 叙事/情绪功能(简短一句)
- 预估时长(秒)
- Keyframe 关键帧:这个镜头要定格生成的关键画面(可 1-2 个)
- 【Image Prompt】:一段可直接复制去图片卡生成关键帧的完整画面提示词(结合具体人物造型、Environment 细节、资产、灯光、色调、构图)
- 【Video Prompt】:一段可直接复制去视频卡的动态提示词(在 Image Prompt 基础上补充动作、运镜、时间变化)

输出要求:
- 中文。镜头之间保持视觉连续性,符合 Beat Sheet 的情绪节奏,人物/场景与前期 Bible 一致
- 不要输出 JSON、不要 Markdown 表格、不要额外解释`,
};

// Asset Bible 生成(按需钻取):资产名/ID + Environment Bible 上下文
const ASSET_BIBLE_PROMPT = `你是世界级电影美术部门资产设计师(Film Production Asset Designer)。请按电影工业 Production Design 的思维工作。

重要:Asset Bible 的职责是【定义一个可复用的场景资产】,让它能在数百个镜头中保持一致性。不要用 Midjourney prompt 思维,不要用单张图片思维。

任务:根据给定的【Environment Bible 上下文】和指定的【资产(含编号与名称)】,为这个资产生成完整的 Asset Bible。用「Asset 编号:名称」起头,严格按以下分节顺序输出(每节用对应中文标题起头,专业自然语言):
1. Story Function 故事功能 — 在剧情中的作用、与角色/冲突的关系
2. Theme Function 主题功能 — 象征意义、隐喻
3. Visual Function 视觉功能 — 在画面中承担的视觉作用、焦点价值
4. Technical Description 技术描述 — 类型、结构、尺寸比例、构造、机械/功能细节
5. Materials 材质 — 主要材质、纹理、磨损/年代感
6. Color Language 色彩语言 — 主色、辅色、与 Environment 色板的关系
7. Visual Signature 视觉标志 — 让它一眼可辨识的独特特征
8. Continuity Rules 连续性规则 — 跨镜头必须保持一致的固定特征
9. AI Generation Rules AI 生成规则 — 生成时必须锁定/避免的要点,防止风格漂移
10. Asset Visual Reference 资产视觉参考 — 一段用于验证资产设计是否符合预期的视觉参考(造型/材质/色彩/标志特征),这是"设计验证参考",不是分镜画面提示词,不要写机位/景别/镜头,画面里只有这一件资产、干净背景

强约束:
- 不要在本阶段生成用于出片的 Video Prompt
- 不要描写人物/场景环境(资产本体特写)、不要输出 JSON、不要 Markdown 表格、不要额外解释`;

// Asset Breakdown Sheet(资产拆解图)— 技术验证:部件/材质/功能/关键部件
const ASSET_BREAKDOWN_PROMPT = `你是世界级电影美术部门资产技术总监(Film Production Asset Technical Director)。请按工业设计图 / 产品拆解图的思维工作。

任务:根据给定的【Asset Bible】和【资产标识】,生成 Asset Breakdown Sheet(资产拆解图说明)。职责是【技术验证】——验证资产的结构组成、材质、功能细节、关键部件是否定义正确。这不是镜头/角度验证。

(以风机塔为例,需拆解到:塔基、法兰环、检修门、紧急停机按钮、系挂环、爬梯、避雷灯等部件,以及各部件的材质细节。)

请按以下结构输出:
- 用「资产标识:名称」起头(标识直接沿用传入的 Asset ID,例如 ST001;严禁生成 ST001-01、ST001-02 这类新编号,部件只用部件名,不要给部件编号)
1. 整体结构 Overall Structure:资产由哪些主要部件组成、装配关系
2. 关键部件 Key Components:逐个列出关键部件(部件名 + 形态/尺寸比例 + 功能 + 材质),每个部件一行,以"· "起头
3. 材质细节 Materials:主体材质、表面处理、磨损/年代感、不同部件的材质差异
4. 功能细节 Functional Details:可动部件、机械/电气/交互细节、工作原理
5. 技术验证要点 Validation Notes:生成图时最容易画错/需重点核对的结构要点

强约束:
- 这是技术拆解,不是多角度展示、不写机位/景别
- Asset ID 仅作系统引用,不要派生子编号
- 中文。不要输出 JSON、不要 Markdown 表格、不要额外解释`;

// Asset Exploration Sheet(资产探索图)— 镜头验证:9 宫格多角度一致性
const ASSET_EXPLORATION_PROMPT = `你是世界级电影摄影指导兼概念美术(Cinematographer & Concept Artist)。

任务:根据给定的【Asset Bible】和【资产标识】,生成 Asset Exploration Sheet(资产探索图说明)。职责是【镜头验证】——验证资产在不同角度下的视觉一致性、空间轮廓,为后续 Shot List 提供角度参考。这不是技术拆解。

默认 9 宫格视图,逐个给出每个视图可直接复制去图片卡生成的画面提示词。固定这 9 个角度:
1. Front View 正视图
2. Front Left 45° 左前45度
3. Front Right 45° 右前45度
4. Left Side 左侧视图
5. Right Side 右侧视图
6. Rear View 后视图
7. Low Angle Hero View 低角度英雄视角
8. High Angle View 高角度俯视
9. Medium Cinematic View 中景电影感视角

请按以下结构输出:
- 用「资产标识:名称」起头(标识直接沿用传入的 Asset ID,例如 ST001;严禁生成 ST001-01 这类子编号,9 个视图只用上面的视图名,不要编号)
- 然后逐个视图,每个用「视图名:」起头,跟一段可直接复制去图片卡的画面提示词
- 每个视图都复述资产的固定标志特征 + 材质 + 色彩,只改变观察机位和构图,确保是同一资产的不同视角(视觉一致)
- 画面里只有这一件资产、干净背景,不要人物、不要场景环境

强约束:
- 9 个视图必须保持同一资产一致(同样造型/材质/色彩/标志),只换角度
- Asset ID 仅作系统引用,不要派生子编号
- 中文。不要输出 JSON、不要 Markdown 表格、不要额外解释`;

// Character Costume & Equipment Bible — 管服装/装备/工具/配件/状态(不管长相,长相在 Character Visual Reference)
// 目标:解决 AI 视频连续性(头盔/工牌/对讲机/安全绳/工具包忽隐忽现、位置漂移、服装变色)
const COSTUME_BIBLE_PROMPT = `你是世界级电影服装设计师兼道具统筹(Costume Designer & Property Master)。

重要:本表【不管理角色长相】(长相已由 Character Visual Reference 锁定)。本表管理【服装、装备、工具、配件、工作状态、特殊状态】,核心目的是解决 AI 视频的连续性问题——避免头盔忽然消失、工牌忽然消失、对讲机位置变化、安全绳有时出现有时消失、工具包换位置、服装颜色漂移。

任务:根据给定的【Character Bible(角色定义)】和指定的【角色】,生成 Character Costume & Equipment Bible。用「角色:姓名」起头,按以下 6 节输出(每节用对应标题起头,专业自然语言):
1. Costume Sets 服装套装 — 列出该角色在故事中会穿的成套服装(例:Work Uniform 工作服 / Casual Outfit 便装 / Weather Protection 防护服 / Injury State 受伤状态),每套描述款式、颜色、材质、剪裁
2. Equipment Sets 装备套装 — 列出随身装备/工具/配件(例:Safety Helmet 头盔 / Safety Harness 安全绳 / Radio 对讲机 / ID Badge 工牌 / Tool Bag 工具包 / Flashlight 手电),每件描述外观、颜色、佩戴位置
3. Carry Rules 佩戴规则 — 什么情境必须带什么(例:高空作业必须佩戴安全绳、风机平台必须戴头盔、对讲机固定挂左肩、工牌固定胸前)
4. Continuity Rules 连续性规则 — 跨镜头必须保持一致的服装/装备规则(哪些必须永远在、固定位置、固定颜色)
5. AI Generation Rules AI生成规则 — 生成时必须锁定的服装与装备清单、避免遗漏的要点、避免颜色漂移
6. Costume Visual Reference 服装视觉参考 — 一段用于验证服装/装备设计的整体参考描述(全套着装的整体外观),这是设计验证参考,不写机位/景别/镜头

强约束:
- 只管服装/装备/工具/配件/状态,不要描写脸部长相/五官/发型(那是 Character Visual Reference 的职责)
- 中文。不要输出 JSON、不要 Markdown 表格、不要额外解释`;

// Character Costume Sheet — 动态格数服装装备表(不是人物转面图)
const COSTUME_SHEET_PROMPT = `你是世界级电影服装/道具概念美术。

任务:根据给定的【Character Costume & Equipment Bible】和指定的【角色】,生成 Character Costume Sheet(服装装备表)。这【不是人物转面图(Turnaround)】,不要生成正面/背面/侧面/45度的人物长相设定。本表是【服装与装备的逐项验证表】,用于锁定 AI 视频连续性。

格数动态决定(不要写死 9 格):
- 根据 Costume & Equipment Bible 里实际有多少服装套装+装备件数来定
- 最少 4 格(简单角色,如普通上班族:发型/眼镜/西装/手表)
- 默认约 9 格
- 复杂角色可扩展到 12~16 格(如风电工程师:头盔/安全绳/工牌/对讲机/工具包/手套/安全靴...;机甲驾驶员:头盔/胸甲/肩甲/腕甲/背包/武器/工具/徽章...)

每格输出格式:
- 用「格N:项目名」起头(N 从 1 递增,项目名如"工作服正面""头盔细节""安全绳细节""全套装备组合")
- 跟一段可直接复制去图片卡生成的画面提示词,只聚焦该服装/装备项目的外观/材质/颜色/佩戴方式/细节
- 最后一格通常是"全套装备组合"(角色穿戴全套的整体参考)
- 干净或纯色背景,聚焦服装装备本身

强约束:
- 不是人物转面图,不做正/背/侧/45°的长相设定
- 每格复述固定颜色/材质,确保跨格一致,服务连续性
- 中文。不要输出 JSON、不要 Markdown 表格、不要额外解释`;

// 依赖链(1基阶段号 → 它依赖的前置阶段号)
const DEPENDS_ON: Record<number, number[]> = {
  1: [], 2: [1], 3: [1], 4: [1], 5: [1, 2, 3, 4], 6: [1, 2, 5, 3, 4],
};

// 拼接前置上下文 + 用户补充输入 → user message
function buildUserMessage(phase: number, input: string, prev: Record<number, string>): string {
  if (phase === 1) {
    return `用户的故事想法/方向:\n${input}\n\n请据此创作完整故事。`;
  }
  const parts: string[] = [];
  const add = (label: string, content?: string) => {
    if (content && content.trim()) parts.push(`【${label}】\n${content.trim()}`);
  };
  for (const dep of DEPENDS_ON[phase]) add(PHASE_NAMES[dep - 1], prev[dep]);
  if (input && input.trim()) parts.push(`【用户补充要求】\n${input.trim()}`);
  if (!parts.length) return `请生成${PHASE_NAMES[phase - 1]}。`;
  return parts.join('\n\n') + `\n\n请据以上内容生成${PHASE_NAMES[phase - 1]}。`;
}

// 调用 n1n
async function callModel(systemPrompt: string, userMessage: string): Promise<string> {
  const keyInfo = await pickKey('n1n');
  let success = false;
  let caught: any = null;
  let response: Response;
  try {
    response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyInfo.keyValue}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });
    success = response.ok;
  } catch (err) {
    caught = err;
    throw err;
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
  if (!response.ok) {
    const errText = await response.text();
    console.error('剧本生成 API 错误:', response.status, errText);
    throw new Error(`API 错误: ${response.status}`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, userId } = body;

    // 守卫:会员 + 每日额度(两种模式共用)
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    // ---------- Asset Bible 按需钻取 ----------
    if (mode === 'asset') {
      const { assetName, envBible, input } = body;
      if (!assetName || !String(assetName).trim()) {
        return NextResponse.json({ error: '缺少资产名称' }, { status: 400 });
      }
      const parts: string[] = [];
      if (envBible && String(envBible).trim()) parts.push(`【Environment Bible 上下文】\n${String(envBible).trim()}`);
      parts.push(`【要生成 Asset Bible 的资产】\n${String(assetName).trim()}`);
      if (input && String(input).trim()) parts.push(`【用户补充要求】\n${String(input).trim()}`);
      const result = await callModel(ASSET_BIBLE_PROMPT, parts.join('\n\n'));
      return NextResponse.json({ success: true, result });
    }

    // ---------- Asset Breakdown Sheet(技术验证) / Asset Exploration Sheet(镜头验证) ----------
    if (mode === 'breakdown' || mode === 'exploration') {
      const { assetName, assetBible, envBible } = body;
      if (!assetName || !String(assetName).trim()) {
        return NextResponse.json({ error: '缺少资产标识' }, { status: 400 });
      }
      const parts: string[] = [];
      parts.push(`【资产标识】\n${String(assetName).trim()}`);
      if (assetBible && String(assetBible).trim()) parts.push(`【Asset Bible】\n${String(assetBible).trim()}`);
      if (envBible && String(envBible).trim()) parts.push(`【Environment Bible 上下文(参考色板/材质)】\n${String(envBible).trim()}`);
      const sys = mode === 'breakdown' ? ASSET_BREAKDOWN_PROMPT : ASSET_EXPLORATION_PROMPT;
      const result = await callModel(sys, parts.join('\n\n'));
      return NextResponse.json({ success: true, result });
    }

    // ---------- Character Costume & Equipment Bible / Character Costume Sheet ----------
    if (mode === 'costumeBible' || mode === 'costumeSheet') {
      const { charName, charBible, costumeBible } = body;
      if (!charName || !String(charName).trim()) {
        return NextResponse.json({ error: '缺少角色名' }, { status: 400 });
      }
      const parts: string[] = [];
      parts.push(`【角色】\n${String(charName).trim()}`);
      if (mode === 'costumeBible') {
        if (charBible && String(charBible).trim()) parts.push(`【Character Bible(角色定义)】\n${String(charBible).trim()}`);
        const result = await callModel(COSTUME_BIBLE_PROMPT, parts.join('\n\n'));
        return NextResponse.json({ success: true, result });
      } else {
        if (costumeBible && String(costumeBible).trim()) parts.push(`【Character Costume & Equipment Bible】\n${String(costumeBible).trim()}`);
        const result = await callModel(COSTUME_SHEET_PROMPT, parts.join('\n\n'));
        return NextResponse.json({ success: true, result });
      }
    }

    // ---------- 阶段生成 ----------
    const { phase, input, prev } = body;
    const p = Number(phase);
    if (!p || p < 1 || p > 6) {
      return NextResponse.json({ error: '无效的阶段' }, { status: 400 });
    }
    const prevMap: Record<number, string> = (prev && typeof prev === 'object') ? prev : {};
    const hasInput = input && String(input).trim();
    const hasPrev = Object.values(prevMap).some((v) => v && String(v).trim());
    if (p === 1 && !hasInput) {
      return NextResponse.json({ error: '请输入你的故事想法' }, { status: 400 });
    }
    if (!hasInput && !hasPrev) {
      return NextResponse.json({ error: '请先生成前置阶段,或在输入框补充内容' }, { status: 400 });
    }

    const systemPrompt = p === 1 ? NOVEL_FRAMEWORK : PHASE_PROMPTS[p];
    const userMessage = buildUserMessage(p, String(input || ''), prevMap);
    const result = await callModel(systemPrompt, userMessage);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('剧本生成失败:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
