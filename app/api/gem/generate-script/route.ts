import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = 'https://api.n1n.ai';

export const maxDuration = 300;

// ============================================================
// 剧本工作室 · 7 阶段文字生成
// 各阶段独立:只收本阶段的用户输入,不自动串联前置(用户想串自己复制)
// ①小说 ②Beat Sheet ③正式剧本 ④人物设计 ⑤场景设计 ⑥道具设计 ⑦拍摄剧本
// 走 n1n 账号池;会员 + 每日额度守卫
// ④⑤⑥用 ===xxx=== 分隔符,便于前端"发送到画布"按条拆卡
// ============================================================

const PHASE_PROMPTS: Record<number, string> = {
  1: `你是专业小说作者。任务:把用户给的简短想法/题材扩写成一段完整、有画面感的小说梗概。
要求:
- 中文输出,600-1000 字
- 交代世界观、主要人物、核心冲突、故事走向
- 文笔流畅,有镜头感,为后续改编剧本打基础
- 只输出小说正文,不要解释、不要标题前缀`,

  2: `你是好莱坞剧本结构师。任务:根据用户提供的故事内容,提炼出结构化的 Beat Sheet(节拍表)。
要求:
- 中文输出
- 按叙事节奏拆成若干关键节拍,每个节拍标注类型并用一句话概括
- 可用节拍类型:建立 / 触发 / 发展 / 升级 / 高潮 / 结局
- 格式:
  1. [建立] 一句话描述
  2. [触发] 一句话描述
  ...
- 每个节拍 10-30 字,聚焦可视化的动作和场景,不要抽象情绪
- 根据内容密度决定节拍数量(通常 6-12 个),不强行凑数
- 只输出节拍表,不要额外解释`,

  3: `你是专业编剧。任务:根据用户提供的故事/节拍,写成标准格式的正式剧本(Screenplay)。
要求:
- 中文输出
- 使用标准剧本格式:
  - 场景标题用「内景/外景 - 地点 - 时间」(如:外景 - 雨夜街头 - 夜)
  - 动作描述用陈述句,现在时
  - 对白格式:角色名单独一行,下面是台词
- 分场清晰,有对白有动作
- 只输出剧本正文,不要解释`,

  4: `你是角色设定师。任务:根据用户提供的剧本/故事,设计其中出现的主要角色。
要求:
- 中文输出
- 每个角色单独成块,块与块之间用一行 ===角色N:角色名=== 作为分隔(N从1递增)
- 每个角色包含:姓名、年龄、外貌特征、性格、服装造型、身份背景
- 描述具体、可视化,便于后续生成角色形象图
- 格式示例:
===角色1:林深===
姓名:林深
年龄:28岁
外貌:...
性格:...
服装:...
背景:...
- 只输出角色设定,不要额外解释`,

  5: `你是场景概念设计师。任务:根据用户提供的剧本/故事,设计其中出现的主要场景。
要求:
- 中文输出
- 每个场景单独成块,块与块之间用一行 ===场景N:场景名=== 作为分隔(N从1递增)
- 每个场景包含:地点、整体氛围、光线、色调、关键布景元素
- 描述具体、可视化,便于后续生成场景概念图
- 格式示例:
===场景1:雨夜街头===
地点:...
氛围:...
光线:...
色调:...
布景:...
- 只输出场景设定,不要额外解释`,

  6: `你是道具/美术设计师。任务:根据用户提供的剧本/故事,设计其中的关键道具。
要求:
- 中文输出
- 每个道具单独成块,块与块之间用一行 ===道具N:道具名=== 作为分隔(N从1递增)
- 每个道具包含:名称、外观、材质、尺寸、用途、在剧情中的作用
- 描述具体、可视化,便于后续生成道具设计图
- 格式示例:
===道具1:青铜怀表===
名称:...
外观:...
材质:...
用途:...
作用:...
- 只输出道具设定,不要额外解释`,

  7: `你是分镜/拍摄统筹。任务:根据用户提供的剧本/故事,拆解成可执行的拍摄剧本(Shot List)。
要求:
- 中文输出
- 每个镜头单独成块,块与块之间用一行 ===镜头N=== 作为分隔(N从1递增)
- 每个镜头包含:景别(全景/中景/特写等)、机位/运镜(平视/俯视/推拉摇移等)、画面内容、预估时长
- 画面内容要具体可视化,直接可作为生成画面的提示词
- 格式示例:
===镜头1===
景别:全景
机位:平视固定
画面:雨夜街头,男主撑黑伞站在路灯下,雨水反光
时长:3秒
- 只输出镜头列表,不要额外解释`,
};

export async function POST(req: NextRequest) {
  try {
    const { phase, input, userId } = await req.json();

    const p = Number(phase);
    if (!p || p < 1 || p > 7 || !PHASE_PROMPTS[p]) {
      return NextResponse.json({ error: '无效的阶段' }, { status: 400 });
    }
    if (!input || !String(input).trim()) {
      return NextResponse.json({ error: '请输入本阶段的内容' }, { status: 400 });
    }

    // 守卫:会员 + 每日额度
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const systemPrompt = PHASE_PROMPTS[p];
    const userMessage = String(input);

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
