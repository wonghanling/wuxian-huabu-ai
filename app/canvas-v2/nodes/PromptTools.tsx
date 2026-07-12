'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCopy, IconPaste } from './icons';

// ============ prompt 框的复制/粘贴/翻译按钮(各卡共用) ============
// 一键复制当前 prompt;一键粘贴剪贴板内容到 prompt;一键中英互译
// 翻译:仅替换输入框文本(用户手动点),不改任何生成/传参逻辑
// jsonControl:可选,仅图片卡传入 → 在复制按钮左边显示「{}」JSON 控制按钮
//   点击弹窗输入 JSON,保存到 config.controlJson,生成时作系统级前缀注入(不解析、纯文本)

interface JsonControl {
  value: string;
  onChange: (json: string) => void;
}

// JSON 控制快捷注入模板(点击填入输入框,用户可再改)
const JSON_PRESETS: { label: string; json: string }[] = [
  {
    label: '服装装备设计',
    json: `{
  "agent_name": "Costume & Equipment Technical Designer",
  "identity": {
    "role": "World-Class Costume Designer, Equipment Designer, Wardrobe Technical Designer and Production Design Specialist",
    "expertise": [
      "film costume design",
      "wardrobe design",
      "technical apparel design",
      "industrial workwear design",
      "equipment design",
      "gear system design",
      "loadout design",
      "product design",
      "concept art design",
      "production design"
    ]
  },
  "mission": "Design professional costume systems, equipment systems, accessories, tools and wearable gear as production-ready technical design sheets.",
  "design_principles": [
    "function first",
    "silhouette clarity",
    "realistic construction",
    "manufacturing plausibility",
    "material consistency",
    "equipment hierarchy",
    "visual readability",
    "professional technical presentation",
    "production-ready design",
    "high-detail breakdown"
  ],
  "required_output": {
    "costume_system": {
      "headgear": "",
      "upper_body": "",
      "inner_layer": "",
      "lower_body": "",
      "footwear": "",
      "gloves": "",
      "belt_system": "",
      "accessories": ""
    },
    "equipment_system": {
      "primary_equipment": [],
      "secondary_equipment": [],
      "tools": [],
      "safety_equipment": [],
      "communication_devices": [],
      "utility_items": []
    },
    "material_system": {
      "fabric_types": [],
      "metal_parts": [],
      "plastic_parts": [],
      "rubber_parts": [],
      "reflective_materials": [],
      "surface_finish": []
    },
    "color_system": {
      "primary_color": "",
      "secondary_color": "",
      "accent_color": "",
      "safety_color": ""
    },
    "visual_signature": {
      "recognizable_elements": [],
      "signature_shapes": [],
      "signature_accessories": []
    }
  },
  "image_sheet_requirements": {
    "front_view": true,
    "back_view": true,
    "side_view": true,
    "equipment_breakdown": true,
    "material_breakdown": true,
    "detail_callouts": true,
    "white_background": true,
    "technical_annotations": true,
    "production_design_board": true
  },
  "sheet_layout": {
    "top_row": ["front_view", "side_view", "back_view"],
    "middle_row": ["helmet", "equipment", "tools"],
    "bottom_row": ["material_details", "fastening_system", "accessory_details"]
  },
  "style_keywords": [
    "costume technical sheet",
    "equipment breakdown board",
    "industrial design board",
    "production design sheet",
    "concept design sheet",
    "product design presentation",
    "white background",
    "technical drawing layout",
    "high detail",
    "professional annotations"
  ],
  "forbidden": [
    "character posing",
    "environment scene",
    "dramatic lighting",
    "cinematic composition",
    "action shot",
    "story illustration",
    "background landscape",
    "full character artwork"
  ]
}`,
  },
  {
    label: '道具设计',
    json: `{
  "agent_name": "Professional Film Prop Designer",

  "identity": {
    "role": "World-Class Film Prop Designer, Production Designer, Industrial Designer and Concept Artist",

    "expertise": [
      "Hero Prop Design",
      "Film and Game Prop Design",
      "Industrial Product Design",
      "Mechanical Structure Design",
      "Functional Object Design",
      "Sci-Fi Prop Design",
      "Historical Prop Design",
      "Material and Surface Design",
      "Manufacturing Process",
      "Visual Storytelling"
    ]
  },

  "mission": "Design professional film props that feel real, functional, manufacturable and visually memorable. Every prop must have clear purpose, believable structure and strong visual identity.",


  "design_philosophy": {

    "core_rules": [
      "Function determines form",
      "Every component must have a purpose",
      "Design must follow real manufacturing logic",
      "Materials must match usage conditions",
      "Wear and damage must tell the history of use",
      "Silhouette must be recognizable instantly",
      "Details must support storytelling"
    ],

    "avoid": [
      "random decoration",
      "unrealistic mechanical structures",
      "meaningless sci-fi elements",
      "inconsistent proportions",
      "over-designed appearance"
    ]
  },


  "prop_design_structure": {


    "1_story_function": {
      "description": "Define the role of the prop in the world, character interaction and story.",
      "include": [
        "purpose",
        "importance",
        "relationship with characters",
        "symbolic meaning"
      ]
    },


    "2_design_concept": {
      "description": "Define the overall design direction.",
      "include": [
        "design inspiration",
        "era",
        "technology level",
        "style language",
        "visual identity"
      ]
    },


    "3_function_and_usage": {
      "description": "Explain how the prop works in reality.",
      "include": [
        "main function",
        "operation method",
        "interaction points",
        "human usage",
        "ergonomic design"
      ]
    },


    "4_structural_breakdown": {
      "description": "Break the prop into professional production components.",
      "include": [
        "main body",
        "outer shell",
        "internal structure",
        "mechanical parts",
        "control elements",
        "connection points",
        "replaceable modules"
      ]
    },


    "5_materials_and_manufacturing": {
      "description": "Define realistic material and production methods.",
      "include": [
        "primary materials",
        "secondary materials",
        "surface treatment",
        "manufacturing process",
        "assembly method"
      ]
    },


    "6_color_language": {
      "description": "Create consistent visual color system.",
      "include": [
        "main color",
        "secondary color",
        "functional color",
        "warning markings",
        "branding elements"
      ]
    },


    "7_surface_condition": {
      "description": "Define the history and usage traces.",
      "include": [
        "wear",
        "scratches",
        "dust",
        "oxidation",
        "repair marks",
        "maintenance state"
      ]
    },


    "8_visual_signature": {
      "description": "Define unique features that make the prop recognizable.",
      "include": [
        "unique silhouette",
        "special components",
        "iconic details",
        "recognition points"
      ]
    },


    "9_continuity_rules": {
      "description": "Maintain consistency across scenes and generations.",
      "include": [
        "fixed shape",
        "fixed colors",
        "fixed components",
        "fixed markings",
        "fixed damage patterns"
      ]
    },


    "10_ai_generation_rules": {
      "description": "Control AI image generation consistency.",
      "must_keep": [
        "same structure",
        "same proportions",
        "same materials",
        "same details",
        "same design language"
      ],

      "must_avoid": [
        "changing components",
        "adding unnecessary parts",
        "different versions",
        "style drift"
      ]
    }

  },


  "visual_reference_sheet": {

    "purpose": "Generate professional prop design sheet for production reference",

    "layout": [
      "Front View",
      "Back View",
      "Side View",
      "Three Quarter View",
      "Top View",
      "Exploded View",
      "Component Detail",
      "Material Detail"
    ],

    "presentation": [
      "white background",
      "clean studio presentation",
      "industrial design board style",
      "technical concept art style",
      "no character",
      "no environment"
    ]
  },


  "final_output": {

    "format": "Professional Prop Bible",

    "sections": [
      "Story Function",
      "Design Concept",
      "Function",
      "Structure",
      "Materials",
      "Color",
      "Surface",
      "Visual Signature",
      "Continuity Rules",
      "AI Generation Rules",
      "Visual Reference"
    ]
  }
}`,
  },
];

export function PromptTools({ value, onPaste, jsonControl }: { value: string; onPaste: (text: string) => void; jsonControl?: JsonControl }) {
  const [translating, setTranslating] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(value || ''); } catch {}
  };
  const paste = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = await navigator.clipboard.readText();
      if (text) onPaste(text);
    } catch {}
  };
  // 含中文 → 译英,否则 → 译中。专有名词/参数/@引用原样保留
  const translate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const src = (value || '').trim();
    if (!src || translating) return;
    const target = /[一-龥]/.test(src) ? 'en' : 'zh';
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src, target }),
      });
      const data = await res.json();
      if (data.translated) onPaste(data.translated);
    } catch {}
    finally { setTranslating(false); }
  };
  const openJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(jsonControl?.value || '');
    setJsonOpen(true);
  };
  const saveJson = () => { jsonControl?.onChange(draft.trim()); setJsonOpen(false); };
  const hasJson = !!(jsonControl?.value || '').trim();
  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()}>
      {jsonControl && (
        <button
          style={{ ...btn, width: 'auto', padding: '0 7px', fontSize: 11, fontWeight: 700,
            color: hasJson ? '#fafafa' : '#a1a1aa',
            background: hasJson ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
            borderColor: hasJson ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)' }}
          onClick={openJson} title="JSON 控制(每次生成按此 JSON,作系统级前缀)">
          {'{ }'}
        </button>
      )}
      <button style={btn} onClick={copy} title="复制 prompt"><IconCopy size={13} /></button>
      <button style={btn} onClick={paste} title="粘贴到 prompt"><IconPaste size={13} /></button>
      <button style={{ ...btn, width: 'auto', padding: '0 7px', fontSize: 11, color: translating ? '#d4d4d8' : '#a1a1aa', cursor: translating ? 'wait' : 'pointer' }}
        onClick={translate} disabled={translating} title="中英互译">
        {translating ? '…' : '译'}
      </button>

      {jsonOpen && jsonControl && createPortal((
        <div className="nodrag nopan nowheel" style={ovl} onClick={() => setJsonOpen(false)}
          onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
          <div className="nodrag nopan nowheel" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>JSON 控制</span>
              <button onClick={() => setJsonOpen(false)} style={xBtn} title="关闭">✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#8b8b92', padding: '0 18px 10px' }}>
              填入 JSON 形式的生成控制(如画风、构图、参数约束)。每次生成都会作为系统级指令注入,优先于下方 prompt。留空则不生效。
            </div>
            {/* 快捷注入:点击填入模板,用户可再改 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 18px 12px' }}>
              <span style={{ fontSize: 11, color: '#71717a', alignSelf: 'center' }}>快捷注入</span>
              {JSON_PRESETS.map((p) => (
                <button key={p.label} onClick={() => setDraft(p.json)} style={presetChip} title={`填入「${p.label}」模板`}>
                  {p.label}
                </button>
              ))}
              <span style={{ ...presetChip, color: '#71717a', borderStyle: 'dashed', cursor: 'default', opacity: 0.7 }}>
                更多模板开发中…
              </span>
            </div>
            <textarea
              className="cv2-scroll"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={'{\n  "style": "cinematic",\n  "lighting": "soft",\n  "composition": "rule of thirds"\n}'}
              spellCheck={false}
              style={ta}
            />
            <div style={modalFoot}>
              <button onClick={() => { setDraft(''); }} style={ghostBtn}>清空</button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setJsonOpen(false)} style={ghostBtn}>取消</button>
              <button onClick={saveJson} style={saveBtn}>保存</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 5,
};
const btn: React.CSSProperties = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', cursor: 'pointer',
  transition: 'background .15s, color .15s',
};

const ovl: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2147483647,
  background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(3px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  width: 'min(560px,92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(180deg,#1a1a1c 0%,#141415 100%)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
  boxShadow: '0 30px 90px rgba(0,0,0,0.8)', overflow: 'hidden',
};
const modalHead: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 18px 10px',
};
const xBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', cursor: 'pointer', fontSize: 13,
};
const ta: React.CSSProperties = {
  margin: '0 18px', minHeight: 220, padding: 12, resize: 'vertical',
  background: '#0c0c0d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
  color: '#e4e4e7', fontSize: 13, fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  lineHeight: 1.6, outline: 'none',
};
const modalFoot: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: 16,
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', cursor: 'pointer', fontSize: 13,
};
const saveBtn: React.CSSProperties = {
  padding: '8px 22px', borderRadius: 9, border: 'none',
  background: 'linear-gradient(135deg,#e4e4e7,#a1a1aa)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const presetChip: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#d4d4d8',
};
