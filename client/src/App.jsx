import { useState } from 'react';
import SheetSvg from './components/SheetSvg.jsx';

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('zh-CN');
const fmtArea = (mm2) => `${Math.round(mm2).toLocaleString('zh-CN')} mm²（${(mm2 / 1e6).toFixed(3)} m²）`;
const pct = (r) => `${(r * 100).toFixed(1)}%`;

let uid = 1;
const newPart = (over = {}) => ({
  key: uid++,
  label: '',
  length: '',
  width: '',
  quantity: 1,
  ...over,
});

export default function App() {
  const [stock, setStock] = useState({ length: 2440, width: 1220 });
  const [kerf, setKerf] = useState(3);
  const [parts, setParts] = useState([
    newPart({ label: 'A-侧板', length: 800, width: 400, quantity: 3 }),
    newPart({ label: 'B-隔板', length: 600, width: 350, quantity: 2 }),
    newPart({ label: 'C-背板', length: 500, width: 500, quantity: 2 }),
  ]);
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const updatePart = (key, field, value) =>
    setParts((ps) => ps.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  const addPart = () => setParts((ps) => [...ps, newPart()]);
  const removePart = (key) => setParts((ps) => ps.filter((p) => p.key !== key));

  async function submit() {
    setLoading(true);
    setErrors([]);
    setResult(null);
    try {
      const resp = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: { length: Number(stock.length), width: Number(stock.width) },
          kerf: Number(kerf),
          parts: parts.map((p) => ({
            label: p.label,
            length: Number(p.length),
            width: Number(p.width),
            quantity: Number(p.quantity),
          })),
        }),
      });
      const data = await resp.json();
      if (!data.ok) setErrors(data.errors || ['计算失败']);
      else setResult(data);
    } catch (e) {
      setErrors([`请求失败：${e.message}（请确认后端已启动）`]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header>
        <h1>🪚 板材下料优化</h1>
        <p className="subtitle">
          矩形原板 · 断头切割（每刀贯穿当前区域）· 计入锯缝 · 零件可旋转
        </p>
      </header>

      <section className="card">
        <h2>① 原板与锯缝</h2>
        <div className="row">
          <label>
            原板长度 (mm)
            <input
              type="number" min="1" value={stock.length}
              onChange={(e) => setStock((s) => ({ ...s, length: e.target.value }))}
            />
          </label>
          <label>
            原板宽度 (mm)
            <input
              type="number" min="1" value={stock.width}
              onChange={(e) => setStock((s) => ({ ...s, width: e.target.value }))}
            />
          </label>
          <label>
            锯缝宽度 (mm)
            <input
              type="number" min="0" step="0.1" value={kerf}
              onChange={(e) => setKerf(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>② 零件清单</h2>
        <table className="parts-table">
          <thead>
            <tr>
              <th>名称（可留空）</th>
              <th>长度 (mm)</th>
              <th>宽度 (mm)</th>
              <th>数量</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => (
              <tr key={p.key}>
                <td>
                  <input
                    type="text" placeholder={`P${i + 1}`} value={p.label}
                    onChange={(e) => updatePart(p.key, 'label', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number" min="1" value={p.length}
                    onChange={(e) => updatePart(p.key, 'length', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number" min="1" value={p.width}
                    onChange={(e) => updatePart(p.key, 'width', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number" min="1" step="1" value={p.quantity}
                    onChange={(e) => updatePart(p.key, 'quantity', e.target.value)}
                  />
                </td>
                <td>
                  <button className="btn-icon" title="删除该行" onClick={() => removePart(p.key)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row actions">
          <button className="btn" onClick={addPart}>＋ 添加零件</button>
          <button className="btn primary" disabled={loading} onClick={submit}>
            {loading ? '计算中…' : '③ 生成裁切方案'}
          </button>
        </div>
      </section>

      {errors.length > 0 && (
        <section className="card error-card">
          <h2>⚠️ 无法生成方案</h2>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <>
          <section className="card">
            <h2>结果汇总</h2>
            <div className="summary">
              <div className="stat">
                <div className="stat-value">{result.summary.sheets}</div>
                <div className="stat-label">用板数（张）</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fmtArea(result.summary.totalWasteArea)}</div>
                <div className="stat-label">总余料面积</div>
              </div>
              <div className="stat">
                <div className="stat-value">{pct(result.summary.utilization)}</div>
                <div className="stat-label">整板利用率</div>
              </div>
            </div>
            <p className="hint">
              原板 {fmt(result.stock.length)}×{fmt(result.stock.width)} mm，锯缝 {fmt(result.kerf)} mm；
              图中灰色斜线区域为余料，红色虚线为切割线（编号即下刀次序），↻ 表示该零件已旋转 90°。
            </p>
          </section>

          {result.sheets.map((sheet) => (
            <section className="card" key={sheet.id}>
              <h2>
                第 {sheet.id} 张板
                <span className="sheet-meta">
                  利用率 {pct(sheet.utilization)} · 余料 {fmtArea(sheet.wasteArea)}
                </span>
              </h2>
              <SheetSvg sheet={sheet} stock={result.stock} />
              <div className="sheet-details">
                <div>
                  <h3>切割次序</h3>
                  <ol className="cut-list">
                    {sheet.cuts.map((c) => (
                      <li key={c.seq}>
                        {c.dir === 'v' ? '竖切' : '横切'} @ {c.dir === 'v' ? 'x' : 'y'} = {fmt(c.at)} mm
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3>余料块（{sheet.wasteRects.length}）</h3>
                  <ul className="waste-list">
                    {sheet.wasteRects.map((r, i) => (
                      <li key={i}>
                        ({fmt(r.x)}, {fmt(r.y)}) 起 {fmt(r.w)}×{fmt(r.h)} mm
                      </li>
                    ))}
                    {sheet.wasteRects.length === 0 && <li>无（零余料）</li>}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </>
      )}

      <footer>锯缝已计入损耗 · 余料面积 = 用板总面积 − 零件总面积</footer>
    </div>
  );
}
