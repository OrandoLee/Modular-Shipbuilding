import { defineConfig } from 'vite'

export default defineConfig({
  // 当前仓库发布到 https://orandolee.github.io/Modular-Shipbuilding/ 时使用此 base。
  // 如果部署到根域名、Vercel 或 Netlify，请改为 base: '/'。
  // 如果仓库改名为 lab-04-modular-shipbuilding，可改为 '/lab-04-modular-shipbuilding/'。
  base: '/Modular-Shipbuilding/',
})
