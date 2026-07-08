// 草稿页：4卡 Bento Grid 布局验证，不影响首页任何模块
// 精确规格：总外框 1600x696(约2.3:1)，列宽 443/674/443，行高 338/338，gap 20px
// 访问路径 /bento-draft 单独查看，确认后再决定是否套用到首页模型矩阵区

const DRAFT_CARDS = [
  { key: 'a', name: '左上卡 (跨左中列)', col: '1 / 3', row: '1 / 2' },   // 1137x338，约3.36:1
  { key: 'b', name: '左下卡', col: '1 / 2', row: '2 / 3' },              // 443x338，约1.31:1
  { key: 'c', name: '中下卡', col: '2 / 3', row: '2 / 3' },              // 674x338，约2:1
  { key: 'd', name: '右侧卡 (跨上下两行)', col: '3 / 4', row: '1 / 3' }, // 443x695，约1:1.57
];

export default function BentoDraftPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-10">
      <div
        className="grid"
        style={{
          gridTemplateColumns: '443px 674px 443px',
          gridTemplateRows: '338px 338px',
          gap: 20,
          width: 1600,
        }}
      >
        {DRAFT_CARDS.map((c) => (
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
    </div>
  );
}
