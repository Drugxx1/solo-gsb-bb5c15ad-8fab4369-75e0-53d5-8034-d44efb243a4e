const PALETTE = [
  '#4C8BF5', '#F2762E', '#3DBB7D', '#9B59D0', '#E8B93E',
  '#2EB5C0', '#E35D8E', '#8CBF3F', '#F25C54', '#5C6BC0',
];

const fmt = (n) => String(Math.round(n * 100) / 100);

/**
 * 单张板的裁切方案图：零件（彩色）、余料（灰色斜线）、切割线（红色虚线 + 次序编号）。
 */
export default function SheetSvg({ sheet, stock }) {
  const maxSide = Math.max(stock.length, stock.width);
  const fs = maxSide * 0.02; // 字体大小（随板尺寸缩放，单位与坐标一致为 mm）
  const stroke = maxSide * 0.002;

  // 按出现顺序为零件名分配颜色
  const colorOf = new Map();
  for (const p of sheet.placements) {
    if (!colorOf.has(p.label)) colorOf.set(p.label, PALETTE[colorOf.size % PALETTE.length]);
  }

  return (
    <svg
      className="sheet-svg"
      viewBox={`0 0 ${stock.length} ${stock.width}`}
      role="img"
      aria-label={`第 ${sheet.id} 张板裁切图`}
    >
      <defs>
        <pattern
          id={`hatch-${sheet.id}`}
          width={maxSide * 0.012}
          height={maxSide * 0.012}
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width={maxSide * 0.012} height={maxSide * 0.012} fill="#f1f1f1" />
          <line x1="0" y1="0" x2="0" y2={maxSide * 0.012} stroke="#d4d4d4" strokeWidth={stroke} />
        </pattern>
      </defs>

      {/* 原板底 */}
      <rect x="0" y="0" width={stock.length} height={stock.width} fill="#fffdf7" />

      {/* 余料 */}
      {sheet.wasteRects.map((r, i) => (
        <rect
          key={`w${i}`}
          x={r.x} y={r.y} width={r.w} height={r.h}
          fill={`url(#hatch-${sheet.id})`} stroke="#c9c9c9" strokeWidth={stroke}
        />
      ))}

      {/* 零件 */}
      {sheet.placements.map((p, i) => {
        const color = colorOf.get(p.label);
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const showLabel = p.w > fs * 3.2 && p.h > fs * 1.5;
        const showDims = p.w > fs * 5.5 && p.h > fs * 3;
        return (
          <g key={`p${i}`}>
            <rect
              x={p.x} y={p.y} width={p.w} height={p.h}
              fill={color} fillOpacity="0.85" stroke="#333" strokeWidth={stroke}
            />
            {showLabel && (
              <text
                x={cx} y={showDims ? cy - fs * 0.25 : cy}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={fs} fontWeight="700" fill="#fff"
              >
                {p.label}
                {p.rotated ? ' ↻' : ''}
              </text>
            )}
            {showDims && (
              <text
                x={cx} y={cy + fs * 0.95}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={fs * 0.72} fill="#fff" opacity="0.95"
              >
                {fmt(p.w)}×{fmt(p.h)}
              </text>
            )}
          </g>
        );
      })}

      {/* 切割线 + 次序编号 */}
      {sheet.cuts.map((c) => {
        const mx = (c.x1 + c.x2) / 2;
        const my = (c.y1 + c.y2) / 2;
        return (
          <g key={`c${c.seq}`}>
            <line
              x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
              stroke="#e02424" strokeWidth={stroke * 1.6}
              strokeDasharray={`${maxSide * 0.012} ${maxSide * 0.008}`}
            />
            <circle cx={mx} cy={my} r={fs * 0.85} fill="#fff" stroke="#e02424" strokeWidth={stroke} />
            <text
              x={mx} y={my}
              textAnchor="middle" dominantBaseline="central"
              fontSize={fs * 0.9} fontWeight="700" fill="#e02424"
            >
              {c.seq}
            </text>
          </g>
        );
      })}

      {/* 外框 */}
      <rect
        x="0" y="0" width={stock.length} height={stock.width}
        fill="none" stroke="#222" strokeWidth={stroke * 1.5}
      />
    </svg>
  );
}
