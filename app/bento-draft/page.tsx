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
          style={{
            gridColumn: c.col,
            gridRow: c.row,
            borderRadius: 24,
            background: 'linear-gradient(160deg, rgb(40,40,40), rgb(16,16,16))',
          }}
        >
          {/* 占位标记 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm" style={{ color: 'rgb(90,90,90)' }}>占位图片 (cover)</span>
          </div>
          {/* 黑色渐变遮罩 */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }}
          />
          {/* 文字叠加 */}
          <div className="relative p-5 text-white text-sm font-semibold">
            {c.name}
          </div>
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
    </div>
  );
}
