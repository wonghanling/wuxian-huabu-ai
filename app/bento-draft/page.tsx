// 草稿页：Bento Grid 布局验证，不影响首页任何模块
// 第一组：总外框 1600x696(约2.3:1)，列宽 443/674/443，行高 338/338，gap 20px
// 第二组：总外框同宽1600，列宽 674/443/443，行高 338/338，gap 20px（左卡竖跨两行，右上大横卡跨两列）
// 访问路径 /bento-draft 单独查看，确认后再决定是否套用到首页模型矩阵区

const GROUP_1 = [
  { key: 'a', name: '左上卡 (跨左中列)', col: '1 / 3', row: '1 / 2' },   // 1137x338，约3.36:1
  { key: 'b', name: '左下卡', col: '1 / 2', row: '2 / 3' },              // 443x338，约1.31:1
  { key: 'c', name: '中下卡', col: '2 / 3', row: '2 / 3' },              // 674x338，约2:1
  { key: 'd', name: '右侧卡 (跨上下两行)', col: '3 / 4', row: '1 / 3' }, // 443x695，约1:1.57
];

const GROUP_2 = [
  { key: 'e', name: 'Black Forest Labs (左卡，跨上下两行)', col: '1 / 2', row: '1 / 3' }, // 674x696，约0.97:1
  { key: 'f', name: 'Luma AI (右上大横卡，跨中右列)', col: '2 / 4', row: '1 / 2' },       // 906x338，约2.68:1
  { key: 'g', name: 'stability.ai (右下左卡)', col: '2 / 3', row: '2 / 3' },              // 443x338，约1.31:1
  { key: 'h', name: 'Hailuo AI (右下右卡)', col: '3 / 4', row: '2 / 3' },                 // 443x338，约1.31:1
];

// 第三组无跨行卡片，上下两行各自独立列宽：上行 443/674/443，下行 674/906
const GROUP_3_ROW1 = [
  { key: 'i', name: 'Pika' },      // 443x338，约1.31:1
  { key: 'j', name: 'KlingAI' },   // 674x338，约1.99:1
  { key: 'k', name: 'Recraft' },   // 443x338，约1.31:1
];
const GROUP_3_ROW2 = [
  { key: 'l', name: 'ByteDance / Seed' }, // 674x338，约1.99:1
  { key: 'm', name: 'Moonvalley' },       // 906x338，约2.68:1
];

// 卡片内部样式复用（占位图+渐变遮罩+文字），跨行/独立行两种布局都用这个
function CardInner({ name }: { name: string }) {
  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm" style={{ color: 'rgb(90,90,90)' }}>占位图片 (cover)</span>
      </div>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }}
      />
      <div className="relative p-5 text-white text-sm font-semibold">{name}</div>
    </>
  );
}

const CARD_STYLE = {
  borderRadius: 24,
  background: 'linear-gradient(160deg, rgb(40,40,40), rgb(16,16,16))',
} as const;

function BentoGroup({
  cards,
  columns,
}: {
  cards: { key: string; name: string; col: string; row: string }[];
  columns: string;
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: columns,
        gridTemplateRows: '338px 338px',
        gap: 20,
        width: 1600,
      }}
    >
      {cards.map((c) => (
        <div
          key={c.key}
          className="relative overflow-hidden flex items-end"
          style={{ gridColumn: c.col, gridRow: c.row, ...CARD_STYLE }}
        >
          <CardInner name={c.name} />
        </div>
      ))}
    </div>
  );
}

// 第三组：无跨行卡片，上下两行各自独立列宽，用 flex 逐行排列即可
function BentoFlexRow({
  cards,
  widths,
}: {
  cards: { key: string; name: string }[];
  widths: number[];
}) {
  return (
    <div className="flex" style={{ gap: 20, width: 1600, height: 338 }}>
      {cards.map((c, i) => (
        <div
          key={c.key}
          className="relative overflow-hidden flex items-end flex-shrink-0"
          style={{ width: widths[i], height: 338, ...CARD_STYLE }}
        >
          <CardInner name={c.name} />
        </div>
      ))}
    </div>
  );
}

export default function BentoDraftPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-black p-10">
      <BentoGroup cards={GROUP_1} columns="443px 674px 443px" />
      <BentoGroup cards={GROUP_2} columns="674px 443px 443px" />
      <div className="flex flex-col" style={{ gap: 20, width: 1600 }}>
        <BentoFlexRow cards={GROUP_3_ROW1} widths={[443, 674, 443]} />
        <BentoFlexRow cards={GROUP_3_ROW2} widths={[674, 906]} />
      </div>
    </div>
  );
}
