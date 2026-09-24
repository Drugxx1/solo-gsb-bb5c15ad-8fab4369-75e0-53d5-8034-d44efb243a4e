# 板材下料优化（Cutlist Optimizer）

面向小型手作工坊的矩形板材下料排样 Web 应用。输入原板尺寸、锯缝宽度和零件清单（长/宽/数量），系统按**固定排序 + 断头切割（Guillotine）**规则生成逐板裁切方案，并用图示标出**零件、余料与切割次序**。

- 前端：React（Vite 构建）
- 后端：Node.js + Express（内置排样算法，无外部服务依赖）
- 部署：单容器，一条命令启动（依赖安装已包含在镜像构建中）

## 一键启动

```bash
docker compose up --build
```

启动后访问：**http://localhost:8080**

> 镜像构建过程会自动完成后端依赖安装（`npm install`）与前端构建（`npm run build`），无需任何手动步骤。停止：`Ctrl+C` 或 `docker compose down`。

## 必要配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| 访问端口 | `8080` | 修改 `docker-compose.yml` 中 `ports` 左侧的宿主机端口，如 `"9000:8080"` 后访问 `http://localhost:9000` |
| `PORT` 环境变量 | `8080` | 容器内服务监听端口，一般无需改动；若改动需同步调整 `ports` 右侧 |

不使用 Compose 时也可直接构建运行：

```bash
docker build -t cutlist-optimizer .
docker run -p 8080:8080 cutlist-optimizer
```

## 功能与规则

- **输入**：原板长/宽（mm）、锯缝宽度（mm）、若干零件（名称、长、宽、数量）。
- **零件可旋转**：每块零件按 0°/90° 两种朝向尝试，取最优放入。
- **固定排序**：面积降序 → 长边降序 → 短边降序 → 名称升序，同样输入必然得到同样结果。
- **断头切割**：每一刀都贯穿当前矩形区域。放入零件后先把当前矩形一刀切成两条，再对零件所在条带切第二刀，得到「零件 + 两块余料」；先横切还是先竖切由哪侧留下的余料条更大决定（相等时固定先竖切）。
- **锯缝计入**：每真实下刀一次，切口处损耗一个锯缝宽度的材料，余料相应缩小；不足一刀宽度的废料条计入损耗。
- **明确报错**：任何零件（含旋转后）放不进空原板时，直接列出该零件并拒绝计算。
- **结果展示**：用板数、总余料面积、整板利用率；每张板的裁切图（彩色零件、灰色斜线余料、红色虚线切割线及下刀序号、↻ 表示已旋转）、切割次序清单和余料块清单。

> 说明：排样采用「最佳适配 + 断头切割」启发式算法，速度快、结果稳定，但不保证数学上的全局最优。

## 本地开发（不使用 Docker）

需要 Node.js 20+。分别开两个终端：

```bash
# 终端 1：后端（http://localhost:8080）
cd server && npm install && npm run dev

# 终端 2：前端（http://localhost:5173，/api 自动代理到 8080）
cd client && npm install && npm run dev
```

生产模式本地运行：`cd client && npm run build`，然后 `cd server && npm start`，访问 http://localhost:8080。

## API

### `POST /api/optimize`

请求体：

```json
{
  "stock": { "length": 2440, "width": 1220 },
  "kerf": 3,
  "parts": [
    { "label": "A", "length": 800, "width": 400, "quantity": 3 },
    { "label": "B", "length": 600, "width": 350, "quantity": 2 }
  ]
}
```

成功响应（`200`）：`ok`、`summary`（`sheets` 用板数、`totalWasteArea` 总余料面积、`utilization` 利用率）、`sheets`（每板的 `placements` 零件坐标、`cuts` 切割次序、`wasteRects` 余料块）。

失败响应（`422`）：

```json
{ "ok": false, "errors": ["零件「BIG」(3000×1500) 无法放入原板 2440×1220（旋转后仍放不下），请修改尺寸或更换原板"] }
```

## 目录结构

```
├── Dockerfile            # 多阶段：前端构建 → 后端依赖 → 运行镜像
├── docker-compose.yml    # 一键启动（docker compose up --build）
├── server/               # Express 服务 + 断头切割排样算法
│   ├── index.js          #   API 与静态托管
│   └── guillotine.js     #   排样算法（排序/旋转/锯缝/切割次序）
└── client/               # React 前端（表单 + SVG 裁切图）
    └── src/
        ├── App.jsx
        └── components/SheetSvg.jsx
```
