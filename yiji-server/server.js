const http = require('http');
const { send, readBody } = require('./lib/util');
const auth = require('./lib/auth');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const shareRoutes = require('./routes/share');

const PORT = process.env.PORT || 8787;

// 从 Authorization: Bearer <token> 解析出会话
function authUser(req) {
  const m = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = auth.verify(m[1]);
  const session = auth.sessions.get(m[1]);
  if (!payload || !session) return null;
  return { token: m[1], uid: payload.uid, session };
}

const server = http.createServer(async (req, res) => {
  // CORS：本地联调允许跨域；生产可在 .env 限定 CORS_ORIGIN
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const p = new URL(req.url, 'http://localhost').pathname;
  let json = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    try { json = JSON.parse(await readBody(req) || '{}'); } catch (e) { json = {}; }
  }
  const ctx = { auth, db: require('./lib/db'), sessions: auth.sessions };

  try {
    if (p === '/api/health') return send(res, 200, { ok: true, ts: Date.now() });
    if (p.startsWith('/api/auth/')) return authRoutes(req, res, json, ctx);
    if (p.startsWith('/api/sync/')) {
      const u = authUser(req);
      if (!u) return send(res, 401, { error: '未登录或登录已失效' });
      return syncRoutes(req, res, json, { ...ctx, user: u });
    }
    if (p.startsWith('/api/share/')) {
      const u = authUser(req);
      if (!u) return send(res, 401, { error: '未登录' });
      return shareRoutes(req, res, json, { ...ctx, user: u });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: String((e && e.message) || e) });
  }
});

server.listen(PORT, () => {
  console.log('一记同步服务已启动: http://localhost:' + PORT);
});
