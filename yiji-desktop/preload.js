// 预加载脚本：在隔离环境中向渲染进程安全暴露文件备份能力
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  // 写入备份文件到 userData/backups（独立于 localStorage，清档/重装也不丢）
  saveBackupFile: (filename, json) => ipcRenderer.invoke('backup-save', { filename, json }),
  // 弹出打开对话框，返回文件内容（字符串）；取消返回 null
  pickImportFile: () => ipcRenderer.invoke('backup-open'),
  // 自愈读取：localStorage 丢失时从自动备份文件找回（读不到返回 null）
  readBackupFile: (filename) => ipcRenderer.invoke('backup-read', { filename })
});
