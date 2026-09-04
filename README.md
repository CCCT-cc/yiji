<p align="center">
  <img src="./assets/cover.png" alt="一记封面" width="760">
</p>

# 一记 · 极简记账（开源全家桶）

**一记** 是一款纯本地、离线可用、数据不出设备的极简记账工具。一个字就能记一笔，支持多账户、分类、预算提醒、定期账单自动补记，以及**完整账本备份 / 恢复**——清档、重装、误删都不怕丢数据。

本仓库是一个 monorepo，包含同一套账本逻辑的多种形态：

| 目录 | 形态 | 说明 |
|------|------|------|
| [`yiji/`](./yiji) | 网页版（PWA） | 零依赖纯前端，可直接托管到任意静态服务器 / GitHub Pages |
| [`yiji-desktop/`](./yiji-desktop) | 桌面版（Electron） | 把网页版封装成 Windows/macOS/Linux 桌面应用，含完整备份/恢复 |
| [`yiji-cap/`](./yiji-cap) | 安卓版（Capacitor） | 由网页版打包成安卓 APK/AAB |
| [`yiji-mp/`](./yiji-mp) | 微信小程序 | 原生小程序工程（需替换为你自己的 AppID 后上传） |
| [`yiji-server/`](./yiji-server) | 后端服务（可选） | 零依赖 Node 服务，提供**端到端加密**的云端多设备同步与账号体系 |

## 核心特性

- 📝 极简录入，支持语音速记
- 💰 多账户 & 净资产自动核算
- 🏷️ 自定义分类 / 预算温和提醒
- 🔁 定期账单自动补记
- 📊 按月 / 按分类的收支统计
- 💾 **数据安全**：每次保存自动本地兜底备份；可一键导出/导入完整 JSON；桌面版启动异常时自动从备份自愈
- 🔒 **隐私优先**：所有数据仅存于本机，不上传任何第三方服务器
- ☁️ **可选云端同步**：自托管 [`yiji-server`](./yiji-server) 提供**端到端加密**的多设备同步与「一记账号」，服务端只存密文，密钥永不离开你的设备

## 快速开始

各子项目相互独立，进入对应目录查看各自的 `README.md`：

```bash
# 桌面版（最推荐，开箱即用）
cd yiji-desktop && npm install && npm start

# 网页版
cd yiji && python -m http.server 8080   # 然后浏览器打开 http://localhost:8080

# 安卓版（需 Android Studio + 自建签名）
cd yiji-cap && npm install && npx cap sync android

# 微信小程序（需微信开发者工具，替换 AppID）
# 用微信开发者工具打开 yiji-mp/ 目录

# 可选 · 自托管云端同步后端
cd yiji-server && cp .env.example .env && node server.js   # 默认监听 :3000
```

> 前端默认以 `http://localhost:3000` 作为同步服务地址；改用你自己的服务器时，在网页/桌面版「我的 → 云端同步」里设置服务端地址即可。

## 许可证

MIT —— 可自由查看、使用、修改、再分发。

> ⚠️ 仓库仅含源代码，不含任何用户账本数据与发布签名密钥。安卓签名请在本地按 `yiji-cap/android/keystore.properties.example` 自行配置。
