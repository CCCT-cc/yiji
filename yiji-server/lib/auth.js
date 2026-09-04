const crypto = require('crypto');

// 生产环境务必用环境变量覆盖；留空仅用于本地开发
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

// token -> { userId, key }  内存会话（重启即失效，客户端重新登录即可）
const sessions = new Map();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + h.toString('hex');
}

function verifyPassword(pw, stored) {
  const [s, h] = (stored || '').split(':');
  if (!s || !h) return false;
  const hh = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  try { return crypto.timingSafeEqual(hh, Buffer.from(h, 'hex')); }
  catch (e) { return false; }
}

// 由密码 + 每个用户独立的 salt 派生出 AES-256 密钥（服务端加密存储用）
function deriveKey(pw, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(pw, salt, 32);
}

// AES-256-GCM 加密；返回 iv:tag:cipher（hex）
function encrypt(key, plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const e = Buffer.concat([c.update(Buffer.from(plain, 'utf8')), c.final()]);
  const tag = c.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + e.toString('hex');
}

function decrypt(key, packed) {
  const [iv, t, ct] = (packed || '').split(':');
  if (!iv || !t || !ct) throw new Error('密文格式错误');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(t, 'hex'));
  return Buffer.concat([d.update(Buffer.from(ct, 'hex')), d.final()]).toString('utf8');
}

function sign(payload) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}

function verify(token) {
  try {
    const [h, p, s] = token.split('.');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(s))) return null;
    return JSON.parse(Buffer.from(p, 'base64url').toString());
  } catch (e) { return null; }
}

module.exports = { hashPassword, verifyPassword, deriveKey, encrypt, decrypt, sign, verify, sessions };
