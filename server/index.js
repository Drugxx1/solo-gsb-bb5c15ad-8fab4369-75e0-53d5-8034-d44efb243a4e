import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { optimize } from './guillotine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '1mb' }));

// 下料优化接口
app.post('/api/optimize', (req, res) => {
  try {
    const result = optimize(req.body);
    if (result.errors?.length) {
      return res.status(422).json({ ok: false, errors: result.errors });
    }
    const { errors, ...data } = result;
    res.json({ ok: true, ...data });
  } catch (e) {
    res.status(400).json({ ok: false, errors: [`请求格式错误：${e.message}`] });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 生产模式：托管前端构建产物
const dist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`[cutlist] 服务已启动: http://localhost:${PORT}`);
});
