# 一记 · 云端同步后端（yiji-server）

零依赖的 Node.js 服务，为「一记」记账提供**账号**与**账本云同步**能力。前端（网页版 / 桌面版）登录后即可把账本加密备份到服务端，换设备、重装、清档都能一键找回。

## 特性
- **账号系统**：注册 / 登录 / 登出 / 取当前用户（密码用 `scrypt` 加盐哈希，令牌为自实现 HMAC-JWT）
- **账本云同步**：`PUT/GET /api/sync/` 上传 / 下载整本账本
- **服务端加密存储**：账本以 AES-256-GCM 密文落盘，密钥由用户密码派生、仅存于内存会话，服务端**不持有明文**
- **可扩展骨架**：`/api/share/*` 已预留社交 / 家庭账本协作接口（返回 501）
- **零运行时依赖**：只用 Node 内置 `http` / `crypto` / `fs`，无需 `npm install`

## 运行

```bash
cd yiji-server
cp .env.example .env        # 改 JWT_SECRET 为随机长串
node server.js              # 默认监听 http://localhost:8787
```

要求 Node ≥ 16。

## 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/health` | 健康检查 |
| POST | `/api/auth/register` | 注册 `{email,password,name?}` → `{token,syncSalt,user}` |
| POST | `/api/auth/login` | 登录 `{email,password}` → `{token,syncSalt,user}` |
| GET  | `/api/auth/me` | 取当前用户（需 `Authorization: Bearer <token>`） |
| POST | `/api/auth/logout` | 登出 |
| PUT  | `/api/sync/` | 上传账本 `{ledger:<json字符串>}` |
| GET  | `/api/sync/` | 下载账本 `{exists,ledger,updatedAt}` |
| *    | `/api/share/*` | 社交/协作（规划中，返回 501） |

## 安全说明
- 默认 `CORS_ORIGIN=*`，仅适合本地联调；对外暴露时请在 `.env` 限定前端域名并**前置 HTTPS 反向代理**（如 Nginx / Caddy）。
- 服务端只存密文，但账号密码在登录请求中以明文传输——务必通过 HTTPS 暴露公网，本地 `localhost` 不受影响。
- 数据位于 `DATA_DIR`（默认 `./data/db.json`），已被 `.gitignore` 忽略。重置只需删除该目录。
- 会话保存在内存，服务重启后所有登录失效，客户端重新登录即可。

## 自托管 / 部署
- 个人使用：在本机或家里 NAS / 树莓派常驻 `node server.js`，前端把同步地址填 `http://你的内网IP:8787`。
- 公网：用 Caddy/Nginx 反代到 `localhost:8787` 并开启 HTTPS，再把 `CORS_ORIGIN` 设为你的前端域名。
