'use client';

import { useState, useRef, useEffect } from 'react';

// ============================================================
// useDebouncedField — 输入框本地 state + 防抖写全局 + 中文输入法兼容
// 复刻原网 CustomCard 的 localPrompt + updateShapeDebounced + isComposing 机制。
// 打字时只更新本地 state(textarea 立即响应),全局 store 防抖更新,
// 避免每次按键都触发全局重渲染而打断中文输入法。
//
// 用法:
//   const f = useDebouncedField(data.text ?? '', (v) => updateCard(id, { text: v }));
//   <textarea value={f.value} {...f.bind} />
// ============================================================
export function useDebouncedField(external: string, commit: (v: string) => void, delay = 300) {
  const [local, setLocal] = useState(external);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部值变化(切卡/连线传参/生成结果)同步本地
  useEffect(() => { setLocal(external); }, [external]);

  const writeGlobal = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), delay);
  };

  return {
    value: local,
    bind: {
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        const v = e.target.value;
        setLocal(v);
        if (!composing.current) writeGlobal(v);
      },
      onCompositionStart: () => { composing.current = true; },
      onCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        composing.current = false;
        const v = (e.target as HTMLTextAreaElement).value;
        setLocal(v);
        writeGlobal(v);
      },
    },
  };
}
