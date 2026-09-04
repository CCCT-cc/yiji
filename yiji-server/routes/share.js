const { send } = require('../lib/util');

// 社交 / 分享能力占位（可扩展骨架）
// 规划中的接口（暂未实现）：
//   GET  /api/share/links    已分享的账本链接
//   POST /api/share/invite   邀请协作者（家庭账本 / 情侣账本）
//   GET  /api/share/members  某账本的协作成员
// 当前返回 501，便于前端提前对接、后端逐步补齐。
module.exports = function (req, res, json, ctx) {
  return send(res, 501, {
    error: '社交/分享功能规划中（接口已预留）',
    plan: ['GET /api/share/links', 'POST /api/share/invite', 'GET /api/share/members'],
  });
};
