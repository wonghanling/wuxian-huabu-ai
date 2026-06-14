import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = 'https://api.n1n.ai';

export const maxDuration = 300;

// ============================================================
// 剧本工作室 · 7 阶段文字生成
// 顺序与依赖链(后端自动拼前置,前端把已生成的前置内容一起传来):
//   ① 小说       ← 用户想法 + 内置专业 JSON 框架(只当思考框架,输出自然语言)
//   ② Beat Sheet ← ①小说
//   ③ 人物设计   ← ①小说 + 用户输入
//   ④ 场景设计   ← ①小说 + 用户输入
//   ⑤ 道具设计   ← ①小说 + 用户输入
//   ⑥ 正式剧本   ← ①小说 + ②Beat + ③人物 + ④场景 + ⑤道具(全综合)
//   ⑦ 拍摄剧本   ← ①小说 + ②Beat + ⑥正式剧本 + ③人物 + ④场景 + ⑤道具
// 全部阶段输出自然语言(中文),不输出 JSON。
// 走 n1n 账号池;会员 + 每日额度守卫。
// ============================================================

const PHASE_NAMES = ['小说', 'Beat Sheet', '人物设计', '场景设计', '道具设计', '正式剧本', '拍摄剧本'];

// ①小说的专业思考框架(World-Class Novelist & Screenwriter)
// 模型据此构思,但最终输出可读小说,不输出 JSON
const NOVEL_FRAMEWORK = `你是世界级小说家兼影视编剧(World-Class Novelist and Screenwriter),擅长小说创作、电影故事开发、角色弧光、主题表达、冲突升级、三幕式结构、英雄之旅、Save The Cat 节拍、Pixar 故事原则、Show Don't Tell。

请把用户的想法/片段,扩写成一个具备影视改编潜力的完整故事。在构思时(内部思考,不要输出)务必覆盖以下专业维度:
- 故事核心:主题(theme)、前提(premise)、一句话梗概(logline)、核心问题、道德命题
- 主角:外在目标(external_goal)、内在需求(internal_need)、致命缺陷(fatal_flaw)、动机、恐惧、错误信念、角色弧光(起点→转变→终点)
- 冲突系统:主冲突、外部冲突、内部冲突、对抗力量、冲突三级升级(逐步加压)
- 赌注(stakes):个人/关系/社会/世界层面,以及"主角失败会怎样"
- 故事世界:时代、地点、世界规则、社会语境、视觉潜力
- 故事弧线:平凡世界→触发事件→第一转折→上升→中点反转→危机→至暗时刻→高潮→结局→最终画面
- 情绪弧线:开场情绪→中段主导情绪→最低点→高潮情绪→结尾情绪→看完后的观众感受

创作原则:主题先行、人物驱动、冲突驱动、因果叙事、必有情绪弧线、可影视化、Show Don't Tell;
避免:随机事件、无动机行为、剧情漏洞、天降神兵(deus ex machina)。

输出要求:
- 中文,自然流畅的小说叙事文字(梗概 + 展开故事),600-1200 字
- 把内心想法转化为可见的动作和场景,让事件可拍摄
- 只输出小说正文,不要 JSON、不要分镜、不要剧本格式、不要镜头语言、不要解释`;

// ②~⑦ 各阶段 system prompt
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

  // ③ 人物设计
  3: `你是世界级角色架构师(World-Class Character Architect),兼具角色设计师、故事架构师、选角导演三重身份。根据给定的小说故事和用户输入,设计既服务故事又具备视觉识别度和 AI 生成一致性的电影角色资产。

设计哲学:故事功能优先、主题功能优先、必须视觉一致、每个角色都有存在目的;避免冗余角色、避免视觉上的通用脸。

从故事中提取必要角色(不要创造无用角色),为每个角色按以下层次设计:
- 故事功能:原型(参考库:Hero/Mentor/Shadow/Ally/Guardian/Trickster/Herald/Tempter/Mirror/False Hero/Anti Hero/Foil)、叙事角色、与主角关系、冲突功能、主题功能、对弧光施加的压力
- 心理:核心渴望、核心需求、恐惧、错误信念、动机、情感创伤、内在冲突
- 观众设计:第一印象、共情触发、依恋触发、恐惧触发、记忆点
- 视觉设计:性别、年龄、族裔、体型、脸型、五官、眼睛、发型、肤质、剪影、视觉标志(visual signature)
- 服装设计:默认服装、色彩语言、材质语言、配饰、故事含义
- 行为设计:动作风格、手势语言、说话方式、默认情绪状态
- 象征:象征意义、视觉隐喻、与主题的关联
- AI 一致性规则:必须保持脸部结构/视觉标志/核心服装/年龄/性别,避免风格漂移

输出要求(关键,严格遵守此版式):
- 中文。每个角色单独成段,用「角色N:姓名」起头
- 每个角色先给【画面提示词】再给【设计说明】两块:
  【画面提示词】(一段可直接复制去图片卡生成形象的视觉描述,80-150字,只写外观可见信息:性别年龄族裔、脸型五官眼睛发型肤质、体型、默认服装色彩材质配饰、视觉标志、整体气质,末尾可加风格词如"电影感/写实")
  【设计说明】(3-5条短句,每条一行,以"· "起头:原型与叙事角色、核心动机/缺陷、与主角关系、象征意义、AI一致性要点)
- 视觉描述具体可重复生成;设计说明简短克制,不要长段落
- 不要改写故事、不要创造不必要角色、不要输出 JSON、不要 Markdown 表格、不要额外解释`,

  // ④ 场景设计
  4: `你是世界级美术指导(World-Class Production Designer),兼具场景设计、世界观构建、环境叙事架构三重身份。根据给定的小说故事和用户输入,设计既服务故事又具备视觉识别度和 AI 生成一致性的场景系统。

设计哲学:故事功能优先、主题功能优先、情绪功能优先、必须视觉一致、每个场景都有存在目的;避免通用电影场景。

为每个关键场景按以下层次设计:
- 故事功能:地点角色、叙事功能、冲突功能、关系功能、弧光功能(参考场景原型:Safe Haven/Ordinary World/Threshold/Trial Zone/Forbidden Zone/Transformation/Mirror/Conflict Arena/Climax Arena/Memory/Dream/Isolation/Power/Decay/Redemption Space)
- 主题功能:主题呈现、象征意义、视觉隐喻
- 情绪功能:意图情绪、观众感受、情绪转变
- 世界观:时代、地理、文化、技术水平、社会语境、世界规则
- 空间设计:场地类型、布局、尺度、关键区域、动线、前景/中景/背景元素
- 视觉设计:建筑风格、形状语言、材质、纹理、色板、视觉标志
- 灯光设计:主光源、灯光风格、对比度、阴影语言、情绪支撑
- 环境叙事:空间中可见的故事/历史/人物痕迹/重要背景信息
- 电影化设计:运镜机会、纵深机会、视觉揭示机会、张力机会
- AI 一致性规则:保持布局/建筑/色彩语言/标志性元素,避免风格漂移,支持多镜头/角色互动/道具互动

输出要求(关键,严格遵守此版式):
- 中文。每个场景单独成段,用「场景N:名称」起头
- 每个场景先给【画面提示词】再给【设计说明】两块:
  【画面提示词】(一段可直接复制去图片卡生成场景图的视觉描述,80-150字,只写画面可见信息:地点类型、空间布局与尺度、前景/中景/背景关键元素、建筑风格材质纹理、色板、灯光与氛围、视觉标志,末尾可加风格词如"电影感/写实")
  【设计说明】(3-5条短句,每条一行,以"· "起头:故事功能、情绪基调、象征意义、AI一致性要点如必须反复出现的固定元素)
- 视觉描述具体可重复生成;设计说明简短克制,不要长段落
- 不要改写故事、不要输出 JSON、不要 Markdown 表格、不要额外解释`,

  // ⑤ 道具设计
  5: `你是世界级道具设计师兼故事象征架构师(World-Class Prop Designer and Story Symbolism Architect),兼具道具设计、叙事设计、象征专家三重身份。根据给定的小说故事、人物设计、场景设计和用户输入,设计既服务剧情又具备视觉识别度、象征意义和 AI 生成一致性的道具系统。

设计哲学:故事功能优先、主题功能优先、情绪功能优先、必须视觉一致、每个道具都有存在目的;避免随意装饰、避免通用背景物件。

为每个关键道具按以下层次设计:
- 故事功能:叙事角色、情节功能、冲突功能、关系功能、弧光功能(参考道具原型:MacGuffin/Totem/Key/Weapon/Memory Object/Power Symbol/Inheritance/Forbidden/Transformation/Relationship/Identity/Mystery/Quest/Sacrifice Object)
- 主题功能:主题呈现、象征意义、隐喻意义
- 情绪功能:记忆触发、情感联结、观众反应、回报(payoff)功能
- 归属设计:拥有者、与拥有者的关系、人物联结、身份信号
- 视觉设计:道具类型、形状语言、材质、纹理、色板、磨损/年代感、视觉标志
- 世界观功能:技术水平、历史语境、文化语境、社会语境
- 连续性设计:初始状态、状态变化、最终状态、回扣(callback)、铺垫回报
- 电影化功能:特写价值、插入镜头价值、视觉焦点价值、构图价值
- 高级故事设计:setup 铺垫、payoff 回报、callback 回扣、foreshadowing 预示、反转用法
- AI 一致性规则:保持形状/材质/色彩语言/视觉标志/故事功能,避免风格漂移

输出要求(关键,严格遵守此版式):
- 中文。每个道具单独成段,用「道具N:名称」起头
- 每个道具先给【画面提示词】再给【设计说明】两块:
  【画面提示词】(一段可直接复制去图片卡生成道具图的视觉描述,60-120字,只写外观可见信息:道具类型、形状、材质纹理、色彩、尺寸比例、磨损/年代感、视觉标志,末尾可加风格词如"产品特写/电影感")
  【设计说明】(3-5条短句,每条一行,以"· "起头:故事功能/情节作用、拥有者、象征意义、铺垫与回报、AI一致性要点)
- 视觉描述具体可重复生成;设计说明简短克制,不要长段落
- 不要改写故事、不要输出 JSON、不要 Markdown 表格、不要额外解释`,

  // ⑥ 正式剧本
  6: `你是世界级专业编剧(World-Class Professional Screenwriter),兼具电影编剧、剧本医生、影视改编顾问三重身份。精通电影剧本格式、小说改编、场景构建、对白设计、人物弧光执行、冲突升级、潜台词写作、Show Don't Tell、可拍摄动作描写、电影节奏控制。

任务:综合给定的小说、Beat Sheet、人物设计、场景设计、道具设计,生成可拍摄、可表演、可继续拆解为拍摄剧本的正式电影剧本。

素材优先级:小说决定故事本质,Beat Sheet 控制结构节奏,人物/场景/道具设计负责一致性和细节。

剧本规则:用现在时书写;只写可见可听的信息;Show Don't Tell;每场戏必须有目标-冲突-转折,必须改变故事状态;对白必须推进冲突或揭示人物;避免小说式内心独白;避免随意新增剧情;避免无动机的人物行为;不要过度指挥镜头(镜头交给拍摄剧本)。

专业格式:
- 场景标题:内景/外景 - 地点 - 时间(INT./EXT. LOCATION - TIME)
- 动作描述:简洁、可视化、现在时
- 角色名:对白上方单独一行
- 对白:自然、有潜台词、服务冲突
- 必要时用 (画外音 V.O.) (旁白 O.S.) 和必要的转场(CUT TO / FADE IN / FADE OUT)

输出要求:
- 中文,标准剧本格式的自然语言
- 忠实于小说主题/主冲突/主角目标/角色弧光,人物造型/场景/道具与前期设计保持一致
- 不要输出 JSON、不要镜头列表、不要额外解释`,

  // ⑦ 拍摄剧本(Shot List)
  7: `你是世界级电影导演、摄影指导兼视觉叙事架构师(World-Class Film Director, Cinematographer and Visual Storytelling Architect),兼具电影导演、摄影指导、分镜导演、广告片导演、AI 视频导演身份。精通导演调度、摄影、视觉叙事、镜头构图、运镜、走位(blocking)、剪辑节奏、情绪节奏、广告片语言、AI 视频提示词设计、视觉连续性、场景覆盖、镜头动机、场面调度(mise-en-scene)、潜台词视觉化。

任务:综合给定的小说、Beat Sheet、正式剧本、人物设计、场景设计、道具设计,生成可直接用于 AI 视频生成的专业拍摄剧本(Shot List)。

素材优先级:小说定魂,Beat Sheet 定节奏,正式剧本定戏,人物/场景/道具定一致性,拍摄剧本负责把一切转成镜头语言。用户的导演指示(若有)优先级最高。

导演思维原则:每个镜头都要有叙事功能;每个镜头选择都要有动机;视觉叙事重于解释;情绪驱动镜头;构图反映权力关系;走位揭示人物关系;灯光反映情绪状态;道具要按故事目的使用;保持视觉连续性与剪辑节奏。

为每个镜头单独成段,用「镜头N」起头,包含:
- 景别(远景/全景/中景/近景/特写/大特写)
- 机位与运镜(平视/俯视/仰视 + 固定/推/拉/摇/移/跟/手持等)
- 画面内容(结合具体的人物造型、场景细节、道具,描述这一镜里发生什么、谁在做什么)
- 灯光/氛围/色调
- 预估时长(秒)
- 该镜头的叙事/情绪功能(简短)

输出要求:
- 中文,每个镜头的"画面内容"要具体可视化,直接可作为 AI 视频/图像生成的提示词
- 镜头之间保持视觉连续性,符合 Beat Sheet 的情绪节奏
- 不要输出 JSON、不要 Markdown 表格、不要额外解释`,
};

// 依赖链(1基阶段号 → 它依赖的前置阶段号)
const DEPENDS_ON: Record<number, number[]> = {
  1: [], 2: [1], 3: [1], 4: [1], 5: [1], 6: [1, 2, 3, 4, 5], 7: [1, 2, 6, 3, 4, 5],
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

  // 按依赖顺序拼接前置阶段内容
  for (const dep of DEPENDS_ON[phase]) {
    add(PHASE_NAMES[dep - 1], prev[dep]);
  }

  // 用户在本阶段输入框的补充要求(可选)
  if (input && input.trim()) {
    parts.push(`【用户补充要求】\n${input.trim()}`);
  }

  if (!parts.length) {
    return `请生成${PHASE_NAMES[phase - 1]}。`;
  }
  return parts.join('\n\n') + `\n\n请据以上内容生成${PHASE_NAMES[phase - 1]}。`;
}

export async function POST(req: NextRequest) {
  try {
    const { phase, input, prev, userId } = await req.json();

    const p = Number(phase);
    if (!p || p < 1 || p > 7) {
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

    // 守卫:会员 + 每日额度
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const systemPrompt = p === 1 ? NOVEL_FRAMEWORK : PHASE_PROMPTS[p];
    const userMessage = buildUserMessage(p, String(input || ''), prevMap);

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
    const result = (data.choices?.[0]?.message?.content || '').trim();

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('剧本生成失败:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
