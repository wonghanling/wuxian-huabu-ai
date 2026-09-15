'use client';

import { useMemo, useState } from 'react';
import DATA from './recipes.generated.json';

// ============================================================
// 图片配方选择器
//
// 配方是"可选的短提示词模板"，不是需要 Agent 执行的 Skill —— 选中后把
// {{subject}} 换成用户填的需求，拼上公共规则，交给现有生图链路出一张图。
//
// 三点刻意的克制:
//   不伪造案例  全部配方 release_status 都是 draft_unrendered、出图测试 0 次，
//               所以标"实验配方"、封面用占位样式，不放示例图
//   保留来源    每条都有 attribution，来源是方法参考而非原作者背书，
//               界面上如实写明
//   不夺主流程  自由输入生图照旧;选了配方可随时取消回到自由模式
// ============================================================

type Recipe = (typeof DATA.recipes)[number];

const USE_CASE_LABEL: Record<string, string> = {
  poster: '海报 / 主视觉',
  editorial: '内容配图',
  product: '产品图',
  scene: '场景图',
  portrait: '人物形象',
  cover: '封面',
  infographic: '信息图',
  print: '印刷稿视觉',
  branding: '品牌物料',
  illustration: '插画',
};

const REF_LABEL: Record<string, string> = {
  required: '需参考图',
  optional: '参考图可选',
  none: '无需参考图',
};

export function RecipePicker({
  selected,
  onSelect,
}: {
  selected: Recipe | null;
  onSelect: (r: Recipe | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [industry, setIndustry] = useState('');
  const [useCase, setUseCase] = useState('');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return DATA.recipes.filter((r) => {
      if (industry && r.industryId !== industry) return false;
      if (useCase && r.useCase !== useCase) return false;
      if (!kw) return true;
      // 名称与标签都参与搜索 —— 用户可能按行业词也可能按用途词找
      return r.name.toLowerCase().includes(kw)
        || r.tags.some((t) => t.toLowerCase().includes(kw))
        || r.industry.toLowerCase().includes(kw);
    });
  }, [industry, useCase, q]);

  // ── 已选中:显示当前配方，可展开看提示词与来源 ──
  if (selected) {
    return <SelectedCard recipe={selected} onClear={() => onSelect(null)} />;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={entryBtn}>
        选择配方模板
        <span style={{ color: '#86868b', fontWeight: 400 }}>· {DATA.recipes.length} 条</span>
      </button>
    );
  }

  return (
    <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索配方或行业"
          style={{ ...inputSm, flex: 1 }}
        />
        <button onClick={() => setOpen(false)} style={miniGhost}>收起</button>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...inputSm, flex: 1 }}>
          <option value="">全部行业</option>
          {DATA.industries.map((i) => (
            <option key={i.id} value={i.id}>{i.name}（{i.count}）</option>
          ))}
        </select>
        <select value={useCase} onChange={(e) => setUseCase(e.target.value)} style={{ ...inputSm, flex: 1 }}>
          <option value="">全部用途</option>
          {DATA.useCases.map((u) => (
            <option key={u} value={u}>{USE_CASE_LABEL[u] ?? u}</option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 11, color: '#86868b', marginBottom: 8 }}>
        {list.length} 条 · 全部为实验配方，未出图验证
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((r) => (
          <button
            key={r.id}
            onClick={() => { onSelect(r); setOpen(false); }}
            style={rowBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* 封面占位 —— 没有真实出图，不放示例图伪造效果 */}
            <span style={coverBox}>{r.ratio}</span>
            <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 12.5, color: '#1d1d1f', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
              </span>
              <span style={{ display: 'block', fontSize: 10.5, color: '#86868b', marginTop: 2 }}>
                {r.industry} · {USE_CASE_LABEL[r.useCase] ?? r.useCase} · {REF_LABEL[r.refMode] ?? r.refMode}
              </span>
            </span>
          </button>
        ))}
        {list.length === 0 && (
          <div style={{ fontSize: 12, color: '#86868b', padding: '18px 0', textAlign: 'center' }}>
            没有匹配的配方
          </div>
        )}
      </div>
    </div>
  );
}

function SelectedCard({ recipe, onClear }: { recipe: Recipe; onClear: () => void }) {
  const [detail, setDetail] = useState(false);
  return (
    <div style={{ border: '1px solid #1d1d1f', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={coverBox}>{recipe.ratio}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f' }}>{recipe.name}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: '#86868b', marginTop: 3 }}>
            {recipe.industry} · {USE_CASE_LABEL[recipe.useCase] ?? recipe.useCase} · {REF_LABEL[recipe.refMode] ?? recipe.refMode}
          </span>
        </span>
        <button onClick={onClear} style={miniGhost}>取消</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <span style={expTag}>实验配方 · 未出图验证</span>
        <button onClick={() => setDetail((v) => !v)} style={{ ...miniGhost, marginLeft: 'auto' }}>
          {detail ? '收起' : '查看提示词'}
        </button>
      </div>

      {detail && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: 11, color: '#6e6e73', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {/* 把占位符显示成中文 —— {{subject}} 用户看不懂，
                换成【你填的主体】一眼就明白这里会替换成自己的内容 */}
            {recipe.prompt.replaceAll(DATA.placeholder, '【你填的主体】')}
          </div>
          {recipe.attribution && (
            <div style={{ fontSize: 10, color: '#a1a1a6', marginTop: 8, lineHeight: 1.6 }}>
              方法参考：{recipe.attribution}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 把配方渲染成最终提示词。占位符换成用户填的需求，再拼公共规则。 */
export function buildRecipePrompt(recipe: Recipe, subject: string, copy: string): string {
  let p = recipe.prompt.replaceAll(DATA.placeholder, subject.trim() || '主体');
  const parts = [p];
  // 有短文案就带上，没有则按公共规则不留占位文字
  if (copy.trim()) parts.push(`画面中的文字内容：${copy.trim()}`);
  if (DATA.copyPolicy) parts.push(DATA.copyPolicy);
  if (recipe.refMode !== 'none' && DATA.referencePolicy) parts.push(DATA.referencePolicy);
  return parts.join('\n\n');
}

export const RECIPE_COUNT = DATA.recipes.length;

const entryBtn: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px dashed rgba(0,0,0,.18)',
  background: '#fff', color: '#1d1d1f', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const inputSm: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 9, background: '#f5f5f7',
  border: '1px solid transparent', color: '#1d1d1f', fontSize: 12, outline: 'none',
};
const miniGhost: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: '#f5f5f7', color: '#424245', fontSize: 11, whiteSpace: 'nowrap',
};
const rowBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 9,
  border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background .15s ease',
};
/** 比例标签。原来是等封面图的虚线占位框，但不做封面了 ——
 *  改成实心小标签显示建议比例，信息密度反而更高。 */
const coverBox: React.CSSProperties = {
  minWidth: 34, height: 22, flexShrink: 0, borderRadius: 6, background: '#f5f5f7',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 10, color: '#6e6e73', padding: '0 6px',
};
const expTag: React.CSSProperties = {
  fontSize: 10, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fed7aa',
  borderRadius: 6, padding: '3px 7px',
};
