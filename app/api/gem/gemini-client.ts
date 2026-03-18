const YUNWU_BASE_URL = 'https://api.n1n.ai';

export const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;
export { YUNWU_BASE_URL };

/**
 * 从 Gemini 返回里提取纯文本，过滤掉 thought parts
 */
export function extractTextFromGeminiResponse(data: any): string {
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && !p.thoughtSignature && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
}

/**
 * 从文本里提取 JSON，支持 markdown 代码块包裹
 */
export function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (match ? match[1] : text).trim();
}

/**
 * 调用 Gemini API，带 JSON mode + 自动重试一次
 */
export async function callGemini(opts: {
  model: string;
  systemInstruction: string;
  userMessage: string;
  parts?: any[];
  temperature?: number;
  responseSchema?: object;
}): Promise<string> {
  const { model, systemInstruction, userMessage, parts, temperature = 0.5, responseSchema } = opts;

  const generationConfig: any = {
    temperature,
    response_mime_type: 'application/json',
  };
  if (responseSchema) {
    generationConfig.response_schema = responseSchema;
  }

  const contentParts = parts
    ? [...parts, { text: userMessage }]
    : [{ text: userMessage }];

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: contentParts }],
    generationConfig,
  };

  const doRequest = async () => {
    const res = await fetch(
      `${YUNWU_BASE_URL}/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API 错误: ${res.status} - ${err}`);
    }
    return res.json();
  };

  // 第一次请求
  let data = await doRequest();
  let text = extractTextFromGeminiResponse(data);

  // 尝试解析，失败则重试一次
  try {
    JSON.parse(extractJson(text));
  } catch {
    data = await doRequest();
    text = extractTextFromGeminiResponse(data);
  }

  if (!text) throw new Error('API 未返回内容');
  return text;
}
