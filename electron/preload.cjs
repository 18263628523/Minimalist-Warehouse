const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Git operations
  isGitRepo: (path) => ipcRenderer.invoke('git:isRepo', path),
  initGit: (path) => ipcRenderer.invoke('git:init', path),
  getRemote: (path) => ipcRenderer.invoke('git:getRemote', path),
  getStatus: (repoPath) => ipcRenderer.invoke('git:getStatus', repoPath),
  add: (repoPath, files) => ipcRenderer.invoke('git:add', repoPath, files),
  reset: (repoPath, files) => ipcRenderer.invoke('git:reset', repoPath, files),
  checkout: (repoPath, files) => ipcRenderer.invoke('git:checkout', repoPath, files),
  diff: (repoPath, filePath) => ipcRenderer.invoke('git:diff', repoPath, filePath),
  diffCached: (repoPath, filePath) => ipcRenderer.invoke('git:diffCached', repoPath, filePath),
  getFileVersions: (repoPath, filePath) => ipcRenderer.invoke('git:getFileVersions', repoPath, filePath),
  addToIgnore: (repoPath, filePath) => ipcRenderer.invoke('git:addToIgnore', repoPath, filePath),

  // File system
  readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
  getHome: () => ipcRenderer.invoke('app:getHome'),

  // Recent repos
  getRecent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (path) => ipcRenderer.invoke('recent:add', path)
})
