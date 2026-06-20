'use client';

// ============ 图片预设 / 参考图规则 ============
// 全部来源:app/canvas/CustomCard.tsx(照搬原网真实数据)

// —— 风格预设(点击在 prompt 前缀填充,会替换旧风格前缀) ——
export const STYLE_PRESETS: { label: string; prompt: string }[] = [
  { label: '电影写实3D', prompt: '3D animation style, game cinematic, Unreal Engine lighting, realistic shadows, high detail, consistent character,' },
  { label: '超写实电影', prompt: 'cinematic film still, photorealistic, natural skin texture, global illumination, volumetric lighting, depth of field,' },
  { label: '游戏CG', prompt: 'AAA game cinematic, Unreal Engine 5 render, real-time rendering, cinematic lighting, epic atmosphere,' },
  { label: '动漫3D', prompt: 'anime 3D style, stylized character, clean face shading, soft lighting, anime cinematic,' },
  { label: '宫崎骏', prompt: 'Studio Ghibli style, hand-painted background, soft warm lighting, anime film look,' },
  { label: '新海诚', prompt: 'Makoto Shinkai style, ultra detailed sky, light bloom, emotional atmosphere,' },
  { label: '黑暗电影', prompt: 'dark cinematic, moody lighting, low key lighting, dramatic shadows, foggy atmosphere,' },
  { label: '武侠电影', prompt: 'ancient Chinese wuxia style, dusty atmosphere, wind movement, cinematic composition, epic tone,' },
  { label: '赛博朋克', prompt: 'cyberpunk, futuristic city, neon lights, holographic displays, 3D render, Unreal Engine 5, cinematic lighting,' },
  { label: '迪士尼3D', prompt: 'Disney Pixar style, smooth skin, cartoon proportions, bright lighting,' },
  { label: '梦工厂', prompt: 'DreamWorks style, expressive face, stylized realism,' },
  { label: '油画风', prompt: 'oil painting, brush strokes, classical art,' },
  { label: '水墨风', prompt: 'ink wash painting, Chinese ink style, minimalist composition,' },
  { label: '电影胶片', prompt: 'film grain, analog film, vintage cinematic,' },
];

// —— 其他预设(覆盖整段 prompt) ——
export const OTHER_PRESETS: { label: string; prompt: string; accent: string }[] = [
  {
    label: '角色设计',
    accent: 'purple',
    prompt: `Generate a professional MASTER CHARACTER SHEET based on the uploaded reference image.

Preserve the exact identity, face, hairstyle, body proportions, clothing, accessories, colors, and original art style from the reference image.

Create a clean production-style character presentation board including:

- hero portrait
- front / side / back / 3-4 turnaround views
- facial expression studies
- pose variations
- clothing and accessory breakdown
- color palette
- cinematic portrait
- material and texture callouts
- character information panels
- professional editorial layout

High detail, visually organized, consistent character identity across all panels, premium character bible aesthetic, clean background, production-ready presentation design.

Do not redesign the character.
Do not change the art style.
Do not create random collage layouts.
Maintain strong visual consistency in every panel.`,
  },
  {
    label: 'ChatGPT Image 2 - 无颗粒',
    accent: 'blue',
    prompt: `clean illustration, smooth shading, soft lighting, controlled details, minimal texture, high clarity, refined edges, smooth gradients --no noise, grain, artifacts, high frequency detail, dirty texture, oversharpen, blotchy, chaotic details`,
  },
  {
    label: '真人设定',
    accent: 'gray',
    prompt: `对角色设定图中的所有人脸进行隐私遮挡。保持原图构图、人物、衣服、发型、背景不变。只在可见眼睛和嘴巴区域添加纯黑色矩形遮挡条。正脸遮挡双眼和嘴巴，侧脸遮挡可见眼睛和嘴巴。不要改变人物身份、发型、服装、姿态和画面风格。`,
  },
];

// —— 每模型参考图上限(真实规则,来自 CustomCard) ——
export function refImageMax(model: string): number {
  if (model === 'nano-banana-pro-multi') return 10;
  if (model === 'gpt-image-2-all') return 10;
  // 单图模型:flux-kontext / doubao / mj / gpt-image-2
  if (['flux-kontext', 'flux-kontext-max', 'doubao-seedream-4-5-251128', 'mj_imagine', 'gpt-image-2'].includes(model)) return 1;
  // nano-banana / nano-banana-pro 等
  return 2;
}

// 在 prompt 前缀填充风格(替换旧风格前缀,照搬原网逻辑)
export function applyStylePrefix(current: string, stylePrompt: string): string {
  const stylePattern = /^[a-zA-Z0-9 ,.\-()]+,\s*\n?/;
  const clean = stylePattern.test(current) ? current.replace(stylePattern, '') : current;
  return stylePrompt + (clean ? '\n' + clean : '');
}
