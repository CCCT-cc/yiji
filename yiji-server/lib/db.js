const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'db.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    cache = { users: {}, blobs: {} };
  }
  cache.users = cache.users || {};
  cache.blobs = cache.blobs || {};
  return cache;
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(load()));
  fs.renameSync(tmp, FILE); // 原子写，避免半截文件
}

module.exports = { load, save, DATA_DIR };
