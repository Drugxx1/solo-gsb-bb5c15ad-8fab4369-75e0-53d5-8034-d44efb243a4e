/**
 * 矩形板材断头切割（Guillotine Cutting）下料优化核心算法。
 *
 * 规则（全部为确定性规则，同样输入必然得到同样结果）：
 *  1. 零件固定排序：面积降序 → 长边降序 → 短边降序 → 名称升序 → 序号升序。
 *  2. 零件允许旋转 90°，在可用余料矩形中取“剩余面积最小”的位置（最佳适配）。
 *  3. 每一刀都贯穿当前矩形区域（断头切割）：放入零件后，
 *     先沿一个方向把当前矩形一刀切成两条，再对零件所在的条带切第二刀，
 *     从而得到“零件 + 两块余料”。先切哪个方向由哪侧留下的余料条更大决定
 *     （平分秋色时固定先竖切）。
 *  4. 锯缝（kerf）：每真实发生一刀，就在切口处损耗 kerf 宽度的材料，
 *     余料矩形相应缩小；余料不足一刀宽度时该条废料直接丢弃（计入损耗）。
 *  5. 现有板材都放不下时开新板；连空板都放不下的零件在计算前直接报错。
 */

const EPS = 1e-9;

const fmt = (n) => String(Math.round(n * 100) / 100);

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** 校验并规范化输入，返回 { errors, stock, kerf, parts } */
function normalize(input = {}) {
  const errors = [];

  const stockL = toNum(input.stock?.length);
  const stockW = toNum(input.stock?.width);
  if (!(stockL > 0)) errors.push('原板长度必须为正数');
  if (!(stockW > 0)) errors.push('原板宽度必须为正数');

  const rawKerf = input.kerf;
  const kerf = rawKerf === undefined || rawKerf === null || rawKerf === '' ? 0 : toNum(rawKerf);
  if (!(kerf >= 0)) errors.push('锯缝宽度必须为非负数');

  const rawParts = Array.isArray(input.parts) ? input.parts : [];
  if (rawParts.length === 0) errors.push('请至少添加一个零件');

  const parts = [];
  rawParts.forEach((p, i) => {
    const label = String(p?.label ?? '').trim() || `P${i + 1}`;
    const l = toNum(p?.length);
    const w = toNum(p?.width);
    const qty = Math.floor(toNum(p?.quantity));
    if (!(l > 0) || !(w > 0)) {
      errors.push(`零件「${label}」的长度和宽度必须为正数`);
      return;
    }
    if (!(qty >= 1)) {
      errors.push(`零件「${label}」的数量必须为不小于 1 的整数`);
      return;
    }
    parts.push({ label, l, w, qty });
  });

  return { errors, stock: { l: stockL, w: stockW }, kerf, parts };
}

/**
 * 主入口：计算逐板裁切方案。
 * 返回 { errors: [...] } 表示失败；否则返回 { errors: [], stock, kerf, summary, sheets }。
 */
export function optimize(input) {
  const { errors, stock, kerf, parts } = normalize(input);
  if (errors.length) return { errors };

  // 连空原板（含旋转）都放不下的零件 → 明确报错
  const fits = (p) =>
    (p.l <= stock.l + EPS && p.w <= stock.w + EPS) ||
    (p.l <= stock.w + EPS && p.w <= stock.l + EPS);
  const unfit = parts.filter((p) => !fits(p));
  if (unfit.length) {
    return {
      errors: unfit.map(
        (p) =>
          `零件「${p.label}」(${fmt(p.l)}×${fmt(p.w)}) 无法放入原板 ` +
          `${fmt(stock.l)}×${fmt(stock.w)}（旋转后仍放不下），请修改尺寸或更换原板`
      ),
    };
  }

  // 按数量展开为逐个零件
  const items = [];
  parts.forEach((p, idx) => {
    for (let k = 1; k <= p.qty; k++) {
      items.push({ label: p.label, l: p.l, w: p.w, idx, copy: k });
    }
  });

  // 固定排序：面积降序 → 长边降序 → 短边降序 → 名称升序 → 输入顺序 → 副本序号
  items.sort(
    (a, b) =>
      b.l * b.w - a.l * a.w ||
      Math.max(b.l, b.w) - Math.max(a.l, a.w) ||
      Math.min(b.l, b.w) - Math.min(a.l, a.w) ||
      (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) ||
      a.idx - b.idx ||
      a.copy - b.copy
  );

  const sheets = [];
  for (const item of items) {
    let placed = false;
    for (const sheet of sheets) {
      if (placeInSheet(sheet, item, kerf)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet = {
        id: sheets.length + 1,
        free: [{ x: 0, y: 0, w: stock.l, h: stock.w }],
        placements: [],
        cuts: [],
      };
      sheets.push(sheet);
      if (!placeInSheet(sheet, item, kerf)) {
        // 已通过可放入校验，理论上不会走到这里
        return { errors: [`零件「${item.label}」放置失败（内部错误）`] };
      }
    }
  }

  const stockArea = stock.l * stock.w;
  const partsArea = items.reduce((s, p) => s + p.l * p.w, 0);
  const sheetsOut = sheets.map((s) => {
    const usedArea = s.placements.reduce((sum, p) => sum + p.w * p.h, 0);
    return {
      id: s.id,
      placements: s.placements,
      cuts: s.cuts,
      wasteRects: s.free.filter((r) => r.w > EPS && r.h > EPS),
      usedArea,
      wasteArea: stockArea - usedArea,
      utilization: usedArea / stockArea,
    };
  });

  return {
    errors: [],
    stock: { length: stock.l, width: stock.w },
    kerf,
    summary: {
      sheets: sheets.length,
      stockArea,
      partsArea,
      totalWasteArea: stockArea * sheets.length - partsArea,
      utilization: partsArea / (stockArea * sheets.length),
    },
    sheets: sheetsOut,
  };
}

/**
 * 尝试把零件放进某张板：在所有余料矩形中找最佳适配位置（含旋转）。
 * 成功则记录放置与切割次序并更新余料列表，返回 true；放不下返回 false。
 */
function placeInSheet(sheet, item, kerf) {
  let best = null;
  sheet.free.forEach((r, i) => {
    for (const rotated of [false, true]) {
      const w = rotated ? item.w : item.l;
      const h = rotated ? item.l : item.w;
      if (w <= r.w + EPS && h <= r.h + EPS) {
        const leftover = r.w * r.h - w * h;
        if (!best || leftover < best.leftover - EPS) {
          best = { i, rotated, w, h, leftover };
        }
      }
    }
  });
  if (!best) return false;

  const r = sheet.free.splice(best.i, 1)[0];
  const { w, h } = best;
  const { x, y } = r;
  const remW = r.w - w; // 右侧剩余（未扣锯缝）
  const remH = r.h - h; // 下方剩余（未扣锯缝）

  // 两种下刀顺序可留下的“大余料条”面积，取较大者；相等时固定先竖切
  const rightScore = remW > EPS ? Math.max(0, remW - kerf) * r.h : 0; // 先竖切：右侧条贯通全高
  const bottomScore = remH > EPS ? Math.max(0, remH - kerf) * r.w : 0; // 先横切：下方条贯通全宽
  const verticalFirst = rightScore >= bottomScore;

  sheet.placements.push({
    label: item.label,
    copy: item.copy,
    x,
    y,
    w,
    h,
    rotated: best.rotated,
  });

  const cutV = () => {
    // 竖刀：在 x+w 处一刀切穿当前矩形（高度方向贯通）
    sheet.cuts.push({
      seq: sheet.cuts.length + 1,
      dir: 'v',
      at: x + w,
      x1: x + w,
      y1: y,
      x2: x + w,
      y2: y + (verticalFirst ? r.h : h),
    });
    const fw = remW - kerf;
    if (fw > EPS) {
      sheet.free.push({ x: x + w + kerf, y, w: fw, h: verticalFirst ? r.h : h });
    }
  };
  const cutH = () => {
    // 横刀：在 y+h 处一刀切穿当前矩形（宽度方向贯通）
    sheet.cuts.push({
      seq: sheet.cuts.length + 1,
      dir: 'h',
      at: y + h,
      x1: x,
      y1: y + h,
      x2: x + (verticalFirst ? w : r.w),
      y2: y + h,
    });
    const fh = remH - kerf;
    if (fh > EPS) {
      sheet.free.push({ x, y: y + h + kerf, w: verticalFirst ? w : r.w, h: fh });
    }
  };

  // 每刀都贯穿当前矩形区域；只有真正产生余料分离时才下刀（零件贴边则无需该刀）
  if (verticalFirst) {
    if (remW > EPS) cutV();
    if (remH > EPS) cutH();
  } else {
    if (remH > EPS) cutH();
    if (remW > EPS) cutV();
  }
  return true;
}
