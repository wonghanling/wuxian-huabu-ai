'use client';

// ============ Kling 对口型卡片配置 ============
// 来源:app/canvas/CustomCard.tsx 的 kling 卡片(只做对口型,运动控制不做)
// 价格:app/api/kling/generate 的 KLING_LIP_SYNC_PRICE(按次固定收费)

export const KLING_LIPSYNC_PRICE = {
  member: 1.085,   // 会员 ¥1.085/次
  normal: 1.285,   // 普通 ¥1.285/次
} as const;

// 输入要求(照搬原网提示文案)
export const KLING_VIDEO_HINT = '上传视频（mp4/mov ≤100MB）';
export const KLING_AUDIO_HINT = '音频（mp3/wav/m4a 2-60秒）';
