// ============================================================
// 从交接的完整配方库提取运行时需要的字段
//
// 为什么不直接 import 原始 JSON:那份 555KB，含 provenance、qa_checks、
// test_status 等核对用的元数据 —— 界面和生成都用不到，却会全部打进客户端包。
// 精简后只留展示与出图必需的字段。
//
// 原始文件保留在 data/ 不动，便于日后核对来源与质量记录。
//
// 用法: node scripts/build-recipes.mjs
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'data/filmavo-image-recipes-300.json';
const OUT = 'app/studio/recipes.generated.json';

const raw = JSON.parse(readFileSync(SRC, 'utf-8'));

const recipes = raw.recipes.map((r) => ({
  id: r.id,
  industryId: r.industry_id,
  industry: r.industry,
  name: r.name,
  useCase: r.use_case,
  ratio: r.default_ratio,
  // optional / required / none —— 界面据此提示要不要传参考图
  refMode: r.reference_mode,
  tags: r.tags ?? [],
  prompt: r.prompt_template,
  // 方法来源要留着 —— 任务书明确要求"来源说明不应丢失"
  sourceFamily: r.source_family,
  attribution: r.provenance?.attribution_note ?? null,
  // 全部是 draft_unrendered，界面要标"实验配方 / 未出图验证"
  status: r.release_status,
  // 封面图先留空 —— 等封面图到位后填相对路径(如 /recipe-covers/dining-01.jpg)。
  // 任务书要求:无真实测试图时用明确的占位样式，不伪造案例。
  cover: null,
}));

const out = {
  schemaVersion: raw.schema_version,
  builtFrom: SRC,
  industries: raw.industries.map((i) => ({ id: i.id, name: i.name, count: i.count })),
  useCases: [...new Set(recipes.map((r) => r.useCase))].sort(),
  // 公共规则:出图时拼在配方提示词后面
  copyPolicy: raw.runtime?.copy_policy ?? '',
  referencePolicy: raw.runtime?.reference_policy ?? '',
  placeholder: raw.runtime?.placeholder ?? '{{subject}}',
  limitations: raw.runtime?.limitations ?? [],
  sources: raw.sources ?? [],
  recipes,
};

writeFileSync(OUT, JSON.stringify(out), 'utf-8');

const kb = (n) => Math.round(n / 1024);
console.log(`源文件   ${kb(readFileSync(SRC).length)} KB`);
console.log(`运行时   ${kb(readFileSync(OUT).length)} KB  ->  ${OUT}`);
console.log(`配方     ${recipes.length} 条 / ${out.industries.length} 行业 / ${out.useCases.length} 种用途`);
