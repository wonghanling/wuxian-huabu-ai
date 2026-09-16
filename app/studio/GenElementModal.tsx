'use client';

import { useState } from 'react';
import { generateImage, getUserId } from '../canvas-v2/lib/api';

// ============================================================
// 生成透明元素
//
// 一次请求直接拿透明 PNG —— 查过 Kie 文档，GPT Image 2.5 系列的 input 支持
// background: transparent，所以不需要"生成完再调一次抠图"，省掉第二笔费用。
//
// 输出必须是 PNG:JPG 没有 alpha 通道，透明会被填成白色或黑色。
//
// 提示词里内置"单一主体、无阴影、无地面"这些约束 —— 用户只写要什么，
// 不用懂怎么写才能出干净的透明图。模型不给用户选:这个场景下 2.5 Sunburst
// 对单主体的表现最稳，暴露选项只会让人选错。
// ============================================================

/** 固定模型。界面上不显示 —— 用户要的是"一个透明元素"，不是选模型。
 *  价格与普通生图完全一致(lib/pricing.ts 里 2K 档 ¥0.437)——
 *  透明只是多传一个 background 参数，Kie 不额外收费。 */
const MODEL = 'gpt-image-2-5-sunburst';

/** 内置约束:让出图尽量好抠。纯色背景比白色更保险 —— 白色主体会与白底融在一起。 */
// 透明输出下的约束与"先出图再抠"不同:不用再要求纯色背景(本来就没有背景)，
// 重点变成"不要投影和地面" —— 那些会被当作主体一起留下来。
const SYSTEM_HINT = [
  '单一主体，完整居中，占画面约八成',
  '透明背景，不要地面、不要投影、不要倒影',
  '主体边缘清晰锐利',
  '正面或四分之三视角，光线均匀，不要强烈侧光',
  '不要文字、水印、边框、多个物体',
].join('；');

export function GenElementModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  /** 拿到透明 PNG 的地址 */
  onDone: (url: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState('');

  const run = async () => {
    const p = prompt.trim();
    if (!p || step) return;
    try {
      const userId = await getUserId();

      setStep('生成中…');
      const url = await generateImage({
        model: MODEL,
        prompt: `${p}。${SYSTEM_HINT}`,
        aspectRatio: '1:1',
        imageQuality: '2k',
        // 关键:一次就出透明 PNG，不必再调抠图
        background: 'transparent',
        userId,
      });

      onDone(url);
      onClose();
    } catch (e: any) {
      alert('生成失败: ' + (e?.message || e));
    } finally {
      setStep('');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16,
          padding: 22, boxShadow: '0 24px 60px -20px rgba(0,0,0,.4)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', marginBottom: 5 }}>
          生成透明元素
        </div>
        <div style={{ fontSize: 11.5, color: '#86868b', marginBottom: 14, lineHeight: 1.6 }}>
          描述一个物体，生成后自动去背景，可直接摆进场景
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="要生成什么，如:一盆绿萝 / 一只白色陶瓷咖啡杯 / 一束向日葵"
          rows={3}
          autoFocus
          style={{
            width: '100%', padding: '11px 13px', borderRadius: 11, background: '#f5f5f7',
            border: '1px solid transparent', fontSize: 13, color: '#1d1d1f',
            outline: 'none', resize: 'none', lineHeight: 1.6, marginBottom: 14,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#a1a1a6' }}>
            {step || '本次扣 ¥0.437，直接输出透明 PNG'}
          </span>
          <button onClick={onClose} disabled={!!step} style={{ ...btn, marginLeft: 'auto' }}>取消</button>
          <button
            onClick={run}
            disabled={!prompt.trim() || !!step}
            style={{
              ...btn, background: '#1d1d1f', color: '#fff',
              opacity: !prompt.trim() || step ? 0.45 : 1,
            }}
          >
            {step ? '处理中' : '生成'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: '#f5f5f7', color: '#1d1d1f', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
};
