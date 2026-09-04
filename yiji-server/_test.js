const http = require('http');
const BASE = 'http://localhost:8787';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => {
        let j; try { j = JSON.parse(d); } catch (e) { j = d; }
        resolve({ status: res.statusCode, body: j });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const assert = (c, m) => { if (!c) { console.log('❌ FAIL:', m); process.exitCode = 1; } else console.log('✅', m); };

  let r = await req('GET', '/api/health');
  assert(r.status === 200 && r.body.ok, 'health');

  const email = 'test' + Date.now() + '@example.com';
  const pw = 'secret123';
  r = await req('POST', '/api/auth/register', { email, password: pw, name: '_tester' });
  assert(r.status === 200 && r.body.token, 'register returns token');
  const token = r.body.token;
  const salt = r.body.syncSalt;

  r = await req('PUT', '/api/sync/', { ledger: JSON.stringify({ books: [{ id: 'b1', name: '测试账本' }], transactions: [{ id: 't1', amount: 12.5 }] }) }, token);
  assert(r.status === 200 && r.body.ok, 'push ledger');

  // 新会话（模拟重启后重新登录）
  r = await req('POST', '/api/auth/login', { email, password: pw });
  assert(r.status === 200 && r.body.token, 'login returns token');
  const token2 = r.body.token;

  r = await req('GET', '/api/sync/', null, token2);
  const pulled = r.body.ledger ? JSON.parse(r.body.ledger) : null;
  assert(r.status === 200 && r.body.exists && pulled && pulled.books[0].name === '测试账本', 'pull returns same ledger');
  assert(pulled && pulled.transactions[0].amount === 12.5, 'ledger content intact');

  // 错误密码
  r = await req('POST', '/api/auth/login', { email, password: 'wrong' });
  assert(r.status === 401, 'wrong password rejected');

  // 无 token 访问 sync
  r = await req('GET', '/api/sync/');
  assert(r.status === 401, 'sync without token rejected');

  // 重复注册
  r = await req('POST', '/api/auth/register', { email, password: pw });
  assert(r.status === 409, 'duplicate register rejected');

  console.log('\n=== 测试完成 ===');
})();
