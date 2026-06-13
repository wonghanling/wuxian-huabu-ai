import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = 'https://api.n1n.ai';

export const maxDuration = 300;

// ============================================================
// 剧本工作室 · 7 阶段文字生成
// 依赖链(后端自动拼前置,前端把已生成的前置内容一起传来):
//   ① 小说       ← 用户想法 + 内置专业 JSON 框架(只当思考框架,输出自然语言)
//   ② Beat Sheet ← ①小说
//   ③ 正式剧本   ← ①小说 + ②Beat Sheet
//   ④ 人物设计   ← ③正式剧本(可选,用户也可自己写)
//   ⑤ 场景设计   ← ③正式剧本(可选)
//   ⑥ 道具设计   ← ③正式剧本(可选)
//   ⑦ 拍摄剧本   ← ③正式剧本 + ④人物 + ⑤场景 + ⑥道具
// 全部阶段输出自然语言(中文),不输出 JSON。
// 走 n1n 账号池;会员 + 每日额度守卫。
// ============================================================

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

// 各阶段 system prompt(②~⑦)
const PHASE_PROMPTS: Record<number, string> = {
  2: `你是好莱坞剧本结构师。根据给定的小说故事,提炼出结构化的 Beat Sheet(节拍表)。
要求:
- 中文输出
- 按叙事节奏拆成若干关键节拍,每个标注类型并用一句话概括
- 可用节拍类型:建立 / 触发 / 发展 / 升级 / 高潮 / 结局
- 格式:
  1. [建立] 一句话描述
  2. [触发] 一句话描述
  ...
- 每个节拍 10-30 字,聚焦可视化的动作和场景,不要抽象情绪
- 节拍数量随内容密度(通常 6-12 个),不强行凑数
- 只输出节拍表,不要额外解释`,

  3: `你是专业编剧。根据给定的小说和 Beat Sheet,写成标准格式的正式剧本(Screenplay)。
要求:
- 中文输出
- 标准剧本格式:场景标题(内景/外景 - 地点 - 时间)、动作描述(现在时陈述句)、对白(角色名单独一行,下面是台词)
- 分场清晰,有对白有动作,忠实于小说的主题/主冲突/主角目标/角色弧光
- 只输出剧本正文,不要解释`,

  4: `你是角色设定师。根据给定的正式剧本(若未提供则根据用户输入),设计其中的主要角色。
要求:
- 中文输出
- 每个角色单独成段,用「角色N:姓名」起头
- 每个角色包含:姓名、年龄、外貌特征、性格、服装造型、身份背景
- 描述具体、可视化,便于后续生成角色形象图
- 只输出角色设定,不要额外解释`,

  5: `你是场景概念设计师。根据给定的正式剧本(若未提供则根据用户输入),设计其中的主要场景。
要求:
- 中文输出
- 每个场景单独成段,用「场景N:名称」起头
- 每个场景包含:地点、整体氛围、光线、色调、关键布景元素
- 描述具体、可视化,便于后续生成场景概念图
- 只输出场景设定,不要额外解释`,

  6: `你是道具/美术设计师。根据给定的正式剧本(若未提供则根据用户输入),设计其中的关键道具。
要求:
- 中文输出
- 每个道具单独成段,用「道具N:名称」起头
- 每个道具包含:名称、外观、材质、尺寸、用途、在剧情中的作用
- 描述具体、可视化,便于后续生成道具设计图
- 只输出道具设定,不要额外解释`,

  7: `你是分镜/拍摄统筹。综合给定的正式剧本、人物设计、场景设计、道具设计,拆解成可执行的拍摄剧本(Shot List)。
要求:
- 中文输出
- 每个镜头单独成段,用「镜头N」起头
- 每个镜头包含:景别(全景/中景/特写等)、机位/运镜(平视/俯视/推拉摇移等)、画面内容、预估时长
- 画面内容要具体可视化,结合人物造型/场景细节/道具,直接可作为生成画面的提示词
- 只输出镜头列表,不要额外解释`,
};

const PHASE_NAMES = ['小说', 'Beat Sheet', '正式剧本', '人物设计', '场景设计', '道具设计', '拍摄剧本'];

// 拼接前置上下文 + 用户补充输入 → user message
function buildUserMessage(phase: number, input: string, prev: Record<number, string>): string {
  const parts: string[] = [];
  const add = (label: string, content?: string) => {
    if (content && content.trim()) parts.push(`【${label}】\n${content.trim()}`);
  };

  switch (phase) {
    case 1:
      // 小说:只有用户想法
      return `用户的故事想法/方向:\n${input}\n\n请据此创作完整故事。`;
    case 2:
      add('小说', prev[1]);
      break;
    case 3:
      add('小说', prev[1]);
      add('Beat Sheet', prev[2]);
      break;
    case 4:
    case 5:
    case 6:
      add('正式剧本', prev[3]);
      break;
    case 7:
      add('正式剧本', prev[3]);
      add('人物设计', prev[4]);
      add('场景设计', prev[5]);
      add('道具设计', prev[6]);
      break;
  }

  // 用户在本阶段输入框的补充要求(可选)
  if (input && input.trim()) {
    parts.push(`【用户补充要求】\n${input.trim()}`);
  }

  if (!parts.length) {
    // 兜底:无前置也无输入(理论上前端会拦,但保险)
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
    // ①必须有用户输入;②③⑦依赖前置(前端应已校验);④⑤⑥可只靠前置或只靠输入
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
