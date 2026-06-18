# LAB 03: Modular Shipbuilding

中文名：模块造船  
项目类型：技术 Demo / 游戏原型  
项目状态：原型

Modular Shipbuilding 是个人网站 LAB / Projects 系列中的第 3 个项目。它接在「数值高塔」「水体沙盒」「网格防御」之后，作为 LAB 03 出现，核心体验是：用模块搭建船体，然后下水测试浮力、重心、吃水与稳定性。

## 核心玩法

玩家在 3D 蓝图船坞中选择不同功能模块，放置到 3 x 3 x 5 的造船网格里。点击 Launch 后，蓝图会转换为一个简化组合刚体，并进入水面测试。系统会根据每个模块的质量、浮力和位置计算漂浮能力、横倾、纵倾、重心高度和失败原因。

完整闭环：

1. 建造船体
2. 下水测试
3. 观察漂浮、下沉、侧倾或翻覆风险
4. 生成诊断报告
5. 返回船坞继续改造

## 本地启动

```bash
npm install
npm run dev
```

本地开发地址：

```txt
http://127.0.0.1:5173/
```

## 构建与预览

```bash
npm run build
npm run preview
```

预览生产构建时访问：

```txt
http://127.0.0.1:4173/Modular-Shipbuilding/
```

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 分支后，GitHub Actions 会执行：

1. 安装 Node LTS
2. 执行 `npm ci`
3. 执行 `npm run build`
4. 将 `dist` 发布到 `gh-pages` 分支
5. GitHub Pages 从 `gh-pages` 分支对外发布

当前 `vite.config.ts` 会自动区分环境：

```ts
base: command === 'serve' ? '/' : '/Modular-Shipbuilding/'
```

本地开发使用 `/`，所以可以直接打开 `http://127.0.0.1:5173/`。生产构建使用 `/Modular-Shipbuilding/`，用于匹配目标仓库 `OrandoLee/Modular-Shipbuilding` 的 GitHub Pages 子路径。如果部署到根域名、Vercel 或 Netlify，请把生产 base 改为：

```ts
base: '/'
```

如果仓库改名为 `lab-03-modular-shipbuilding`，可改为：

```ts
base: '/lab-03-modular-shipbuilding/'
```

## iframe 嵌入

```html
<div class="demo-frame-wrap">
  <iframe
    src="https://orandolee.github.io/Modular-Shipbuilding/?embed=1"
    title="LAB 03: Modular Shipbuilding"
    loading="lazy"
    allow="fullscreen"
    allowfullscreen
  ></iframe>
</div>
```

```css
.demo-frame-wrap {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  border-radius: 24px;
  overflow: hidden;
  background: #05070a;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.demo-frame-wrap iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
```

`?embed=1` 会压缩模块栏和标题尺寸，更适合放进个人网站 iframe。

## 操作说明

- 左键：在 3D 网格中放置当前模块
- 右键：删除格子中的模块
- Delete：删除当前悬停格子中的模块
- R：旋转当前待放置模块；测试模式中重置视角/测试
- C：清空当前设计
- ESC：释放键盘输入并重新显示点击激活提示
- Launch：进入下水测试
- 报告：生成诊断报告

## 模块类型

已实现 8 种模块：

- 木质船体块：轻量基础船体结构
- 浮力块：提供高浮力，适合底部或两侧
- 压载块：很重，降低重心，提升稳定性
- 金属结构块：坚固但偏重
- 引擎模块：提供推进数据，适合船尾或中后部
- 船舵模块：提供转向数据
- 大炮模块：重型上层模块，会提高翻覆风险
- 货物模块：纯负载，用于测试承载能力

## 浮力与稳定性系统

系统不是工程级流体仿真，而是面向交互 Demo 的可信简化模型：

- 每个模块贡献质量、浮力、阻力和特殊能力
- 蓝图统计总质量、总浮力、浮力余量、重心、估算浮心、吃水和稳定评分
- 下水后整船作为一个组合刚体移动
- 波浪高度由多个正弦波叠加生成
- 海况分为平静、小浪和风暴测试
- 浮力余量不足会持续下沉
- 左右质量不均会侧倾
- 前后质量不均会造成船头或船尾下沉
- 上层重物比例过高会放大风浪中的翻覆风险

## 诊断报告

报告由当前蓝图统计和测试过程中的最大横倾、最大纵倾、状态共同生成。它会指出主要失败原因，例如：

- 总浮力不足
- 左右质量分布不均
- 船头或船尾过重
- 上层重物比例过高
- 横向稳定性不足
- 实测持续下沉

报告同时给出改造建议，例如增加底部浮力块、将重物移向中心线、降低上层结构高度、在船底加入少量压载等。

## 主要文件结构

```txt
src/
  main.ts
  styles.css
  app/
    App entry
  build/
    ShipBlueprint.ts
  modules/
    ModuleDefinition.ts
    ModuleTypes.ts
    ModuleMeshFactory.ts
  physics/
    ShipRigidBody.ts
    StabilityAnalyzer.ts
    WaveField.ts
  diagnostics/
    ReportGenerator.ts
public/
  lab.svg
.github/workflows/
  deploy.yml
```

## 已实现功能

- LAB 03 开始界面，实验编号显示为 003，项目序号显示为 03
- 基于 SVG logo 的开场缩放动画
- 3D 蓝图船坞与网格放置
- 8 种模块选择、放置、删除和清空
- 实时船体统计 HUD
- Launch 下水测试
- 三种海况切换
- 简化组合刚体、浮力余量、横倾和纵倾反馈
- 重心、浮心和浮力箭头辅助可视化
- 诊断报告面板
- iframe `?embed=1` 适配
- postMessage 预留：`LAB04_PAUSE`、`LAB04_RESUME`、`LAB04_RESET`
- GitHub Pages 自动部署 workflow

## 后续扩展方向

- 镜像建造模式
- 连通性检测和孤立模块提示
- 蓝图保存与加载
- 更完整的推进和操舵测试
- 船体损伤、耐久和重试回放
- 更丰富的报告图表和测试时间线
