const { send } = require('../lib/util');
const db = require('../lib/db');

// 账本云同步：服务端加密存储（AES-256-GCM，密钥由用户密码派生，仅存于内存会话）
// 服务端只保管密文，不持有明文账本；日志/备份泄露也无法还原。
module.exports = function (req, res, json, ctx) {
  const p = new URL(req.url, 'http://localhost').pathname;
  const { auth, user } = ctx;
  const uid = user.uid;
  const key = user.session.key;
  const d = db.load();
  d.blobs = d.blobs || {};

  // 上传（覆盖式，客户端负责合并）
  if (req.method === 'PUT' && p === '/api/sync/') {
    if (typeof json.ledger !== 'string' || !json.ledger) return send(res, 400, { error: 'ledger 缺失' });
    let parsed;
    try { parsed = JSON.parse(json.ledger); } catch (e) { return send(res, 400, { error: 'ledger 不是合法 JSON' }); }
    if (!parsed || !parsed.books) return send(res, 400, { error: 'ledger 结构异常' });
    const packed = auth.encrypt(key, json.ledger);
    d.blobs[uid] = { cipher: packed, updatedAt: Date.now(), size: json.ledger.length };
    db.save();
    return send(res, 200, { ok: true, updatedAt: d.blobs[uid].updatedAt });
  }

  // 下载
  if (req.method === 'GET' && p === '/api/sync/') {
    const b = d.blobs[uid];
    if (!b) return send(res, 200, { exists: false });
    let ledger;
    try { ledger = auth.decrypt(key, b.cipher); }
    catch (e) { return send(res, 500, { error: '解密失败（可能密码已变更，需重新上传）' }); }
    return send(res, 200, { exists: true, ledger, updatedAt: b.updatedAt });
  }

  return send(res, 404, { error: 'not found' });
};
