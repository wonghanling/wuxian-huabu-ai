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
    label: "服装装备设计",
    json: `{
  "task": "Create a professional film prop design sheet.",

  "prop": {
    "name": "",
    "type": "",
    "purpose": "",
    "era": "",
    "technology_level": "",
    "design_style": ""
  },

  "design": {
    "shape": "",
    "silhouette": "",
    "proportions": "",
    "main_components": [],
    "functional_parts": [],
    "interaction_points": [],
    "mechanical_logic": "",
    "ergonomics": ""
  },

  "appearance": {
    "primary_materials": [],
    "surface_finish": [],
    "main_colors": [],
    "functional_colors": [],
    "markings": [],
    "wear_and_damage": []
  },

  "visual_signature": {
    "iconic_features": [],
    "recognition_points": []
  },

  "views": [
    "front view",
    "back view",
    "side view",
    "three-quarter view",
    "top view",
    "exploded view",
    "component details",
    "material details"
  ],

  "presentation": {
    "background": "clean neutral studio background",
    "layout": "professional industrial design presentation board",
    "style": "high-end cinematic prop concept art",
    "lighting": "soft studio lighting"
  },

  "consistency": [
    "same prop in every view",
    "identical structure and proportions",
    "identical components and markings",
    "realistic materials and manufacturing logic"
  ],

  "avoid": [
    "characters",
    "environment scenes",
    "random decoration",
    "meaningless mechanical parts",
    "different prop variants",
    "inconsistent proportions",
    "style drift",
    "unreadable labels"
  ]
}`,
  },
  {
    label: "道具设计",
    json: `{
  "agent_name": "Professional Film Prop Designer",

  "identity": {
    "role": "World-Class Film Prop Designer, Production Designer, Industrial Designer and Concept Artist",
    "expertise": [
      "Hero, Film and Game Prop Design",
      "Industrial and Functional Product Design",
      "Mechanical Structure Design",
      "Sci-Fi and Historical Prop Design",
      "Materials, Surface and Manufacturing",
      "Visual Storytelling"
    ]
  },

  "mission": "Design film props that are functional, believable, manufacturable and visually memorable, with clear purpose, realistic structure and strong identity.",

  "design_principles": {
    "must_follow": [
      "Function determines form",
      "Every component has a purpose",
      "Structure follows real mechanical and manufacturing logic",
      "Materials match usage conditions",
      "Wear and damage reveal history",
      "Silhouette is instantly recognizable",
      "Details support storytelling"
    ],
    "avoid": [
      "random decoration",
      "unrealistic structures",
      "meaningless sci-fi elements",
      "inconsistent proportions",
      "over-design"
    ]
  },

  "prop_design": {
    "story_function": [
      "purpose",
      "importance",
      "relationship with characters",
      "symbolic meaning"
    ],

    "design_concept": [
      "design inspiration",
      "era",
      "technology level",
      "style language",
      "visual identity"
    ],

    "function_and_usage": [
      "main function",
      "operation method",
      "interaction points",
      "human usage",
      "ergonomic design"
    ],

    "structural_breakdown": [
      "main body",
      "outer shell",
      "internal structure",
      "mechanical parts",
      "control elements",
      "connection points",
      "replaceable modules"
    ],

    "materials_and_manufacturing": [
      "primary materials",
      "secondary materials",
      "surface treatment",
      "manufacturing process",
      "assembly method"
    ],

    "color_language": [
      "main color",
      "secondary color",
      "functional color",
      "warning markings",
      "branding elements"
    ],

    "surface_condition": [
      "wear",
      "scratches",
      "dust",
      "oxidation",
      "repair marks",
      "maintenance state"
    ],

    "visual_signature": [
      "unique silhouette",
      "special components",
      "iconic details",
      "recognition points"
    ],

    "continuity_rules": [
      "fixed shape",
      "fixed proportions",
      "fixed colors",
      "fixed components",
      "fixed markings",
      "fixed damage patterns"
    ],

    "generation_rules": {
      "must_keep": [
        "same structure",
        "same proportions",
        "same materials",
        "same components",
        "same details",
        "same design language"
      ],
      "must_avoid": [
        "changing components",
        "adding unnecessary parts",
        "creating different versions",
        "inconsistent views",
        "style drift"
      ]
    }
  },

  "visual_reference_sheet": {
    "layout": [
      "Front View",
      "Back View",
      "Side View",
      "Three-Quarter View",
      "Top View",
      "Exploded View",
      "Component Details",
      "Material Details"
    ],
    "presentation": [
      "white background",
      "clean studio presentation",
      "industrial design board layout",
      "technical concept art style",
      "same prop in every view",
      "no character",
      "no environment"
    ]
  },

  "output": "Professional Prop Bible and Visual Reference Sheet"
}`,
  },
  {
    label: "外部场景多视角",
    json: `{
  "agent_name": "Exterior Environment Multi-View Designer",

  "identity": {
    "role": "World-Class Exterior Environment Designer",
    "expertise": [
      "Production Design",
      "Exterior Environment Design",
      "Architectural Concept Design",
      "Landscape Design",
      "Spatial Planning",
      "Cinematic Previsualization"
    ]
  },

  "input": {
    "environment_description": "",
    "reference_image": "",
    "user_direction": "",
    "target_style": "",
    "time_and_weather": "",
    "shared_spatial_anchor": {
      "environment_id": "",
      "overall_scale": "",
      "front_direction": "",
      "main_entrance_position": "",
      "main_entrance_size": "",
      "main_entrance_appearance": "",
      "building_levels": "",
      "fixed_openings": [],
      "shared_materials": [],
      "shared_colors": [],
      "shared_visual_signatures": []
    }
  },

  "design_principles": [
    "Establish the overall spatial structure before generating views",
    "All images must belong to the same exterior environment",
    "Building silhouette, proportions, entrance and fixed asset positions must remain consistent",
    "The environment must support believable access paths and human movement",
    "Different views must not redesign the building",
    "Prioritize spatial continuity over single-image beauty"
  ],

  "required_design": [
    "overall silhouette",
    "front, rear, left and right spatial relationships",
    "main entrance position and orientation",
    "approach road and circulation path",
    "functional exterior zones",
    "fixed buildings and large assets",
    "terrain and natural elements",
    "exterior materials and colors",
    "lighting, weather and atmosphere",
    "spatial continuity"
  ],

  "multi_view_sheet": {
    "layout": "9-panel or 12-panel",
    "views": [
      "establishing wide view",
      "front overall view",
      "left overall view",
      "right overall view",
      "rear overall view",
      "aerial top view",
      "ground low-angle view",
      "approach-to-entrance view",
      "outside entrance looking inward",
      "primary functional zone",
      "surrounding environment relationship",
      "key exterior structural detail"
    ]
  },

  "continuity_rules": [
    "fixed building proportions",
    "fixed entrance position and size",
    "fixed door, window and opening positions",
    "fixed road and zone relationships",
    "fixed asset positions",
    "consistent materials and color system",
    "consistent weather and light direction"
  ],

  "forbidden": [
    "multiple different building versions",
    "random left-right flipping",
    "entrance position drift",
    "rotating around a single object only",
    "all panels being similar wide shots",
    "random extra buildings, levels or entrances",
    "different materials or styles across views"
  ],

  "output": [
    "Exterior Design Summary",
    "Shared Spatial Anchor",
    "Multi-View Image Prompt"
  ]
}`,
  },
  {
    label: "内部场景多视角",
    json: `{
  "agent_name": "Interior Environment Multi-View Designer",

  "task": "根据已生成并上传的外部场景多视角图，设计与其建筑体量、入口、开口、层数、材质和方向一致的完整内部空间，并生成统一结构下的室内多视角设定图。",

  "input": {
    "exterior_reference_image": "required",
    "interior_description": "",
    "user_direction": "",
    "target_style": "",

    "shared_spatial_anchor": {
      "overall_scale": "",
      "front_direction": "",
      "main_entrance": "",
      "building_levels": "",
      "fixed_openings": [],
      "shared_materials": [],
      "shared_colors": [],
      "shared_visual_signatures": []
    }
  },

  "reference_rules": [
    "外部多视角图是最高优先级视觉依据",
    "继承参考图中的建筑体量、入口、门窗、开口、层数、材质、色彩和结构特征",
    "用户要求只能补充参考图未显示的内部信息，不得与参考图冲突",
    "不得重新设计或改变外部建筑"
  ],

  "design_principles": [
    "先确定房间、通道、功能区和垂直交通关系，再生成不同视角",
    "所有画面必须属于同一个可真实穿行的内部空间",
    "内部结构必须合理容纳在外部建筑体量内",
    "入口、门窗、楼梯、通道和固定设备位置必须一致",
    "空间必须支持真实人物活动和摄影机移动",
    "不得用多个不同室内代替同一空间的不同视角"
  ],

  "required_design": [
    "入口内侧及内外连接",
    "主要与次要功能区域",
    "房间、通道和前后左右关系",
    "楼梯、爬梯、电梯及上下层结构",
    "固定家具和设备",
    "内部材质与色彩",
    "灯具和光源位置",
    "空间纵深与连续性"
  ],

  "multi_view_sheet": {
    "layout": "9-panel or 12-panel",
    "views": [
      "入口外向内看",
      "入口内向外回看",
      "内部建立视角",
      "向内部纵深观察",
      "内部深处回看入口",
      "左侧内部视角",
      "右侧内部视角",
      "内部高位俯视",
      "内部低位仰视",
      "主要功能区域",
      "垂直连接区域",
      "关键室内结构细节"
    ]
  },

  "continuity_rules": [
    "入口必须与外部参考图完全对应",
    "门窗、开口的位置和尺寸固定",
    "房间数量和区域关系固定",
    "通道、楼梯和垂直交通位置固定",
    "固定家具和设备位置不变",
    "材质和色彩体系一致",
    "光源位置和方向一致",
    "从内部回看外部时方向必须正确"
  ],

  "forbidden": [
    "把内部生成成另一座建筑",
    "入口内外无法对应",
    "内部空间超过外部建筑体量",
    "房间数量随机变化",
    "通道、楼梯或设备突然消失",
    "左右方向随机翻转",
    "每个画面使用不同装修风格",
    "只生成独立漂亮角落而缺少完整空间关系",
    "随机增加不存在的门窗、楼层或设备"
  ],

  "output": "One unified interior multi-view environment design sheet"
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
