const { send } = require('../lib/util');
const crypto = require('crypto');

function userPublic(u) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}

function emailOf(json) { return String(json.email || '').trim().toLowerCase(); }

module.exports = function (req, res, json, ctx) {
  const p = new URL(req.url, 'http://localhost').pathname;
  const { auth, db, sessions } = ctx;

  // 注册
  if (req.method === 'POST' && p === '/api/auth/register') {
    const email = emailOf(json);
    const password = String(json.password || '');
    const name = String(json.name || '') || email.split('@')[0];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: '邮箱格式不正确' });
    if (password.length < 6) return send(res, 400, { error: '密码至少 6 位' });
    const d = db.load();
    if (Object.values(d.users).some((u) => u.email === email)) return send(res, 409, { error: '该邮箱已注册' });
    const userId = crypto.randomBytes(8).toString('hex');
    const syncSalt = crypto.randomBytes(16).toString('hex');
    d.users[userId] = {
      id: userId, email, name,
      pw: auth.hashPassword(password),
      syncSalt,
      createdAt: Date.now(),
    };
    db.save();
    const key = auth.deriveKey(password, syncSalt);
    const token = auth.sign({ uid: userId, iat: Date.now() });
    sessions.set(token, { userId, key });
    return send(res, 200, { token, syncSalt, user: userPublic(d.users[userId]) });
  }

  // 登录
  if (req.method === 'POST' && p === '/api/auth/login') {
    const email = emailOf(json);
    const password = String(json.password || '');
    const d = db.load();
    const u = Object.values(d.users).find((x) => x.email === email);
    if (!u || !auth.verifyPassword(password, u.pw)) return send(res, 401, { error: '邮箱或密码错误' });
    const key = auth.deriveKey(password, u.syncSalt);
    const token = auth.sign({ uid: u.id, iat: Date.now() });
    sessions.set(token, { userId: u.id, key });
    return send(res, 200, { token, syncSalt: u.syncSalt, user: userPublic(u) });
  }

  // 当前用户
  if (req.method === 'GET' && p === '/api/auth/me') {
    const m = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
    if (!m) return send(res, 401, { error: '未登录' });
    const pl = auth.verify(m[1]);
    const s = sessions.get(m[1]);
    if (!pl || !s) return send(res, 401, { error: '登录已失效' });
    const u = db.load().users[s.userId];
    return u ? send(res, 200, { user: userPublic(u), syncSalt: u.syncSalt }) : send(res, 401, { error: '用户不存在' });
  }

  // 登出（仅清除内存会话）
  if (req.method === 'POST' && p === '/api/auth/logout') {
    const m = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
    if (m) sessions.delete(m[1]);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'not found' });
};
