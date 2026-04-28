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
  commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
  commitAmend: (repoPath, message, noEdit) => ipcRenderer.invoke('git:commitAmend', repoPath, message, noEdit),
  push: (repoPath) => ipcRenderer.invoke('git:push', repoPath),
  pushSetUpstream: (repoPath, remote, branch) => ipcRenderer.invoke('git:pushSetUpstream', repoPath, remote, branch),
  commitAndPush: (repoPath, message) => ipcRenderer.invoke('git:commitAndPush', repoPath, message),
  lastCommitMsg: (repoPath) => ipcRenderer.invoke('git:lastCommitMsg', repoPath),
  currentBranch: (repoPath) => ipcRenderer.invoke('git:currentBranch', repoPath),
  trackingBranch: (repoPath) => ipcRenderer.invoke('git:trackingBranch', repoPath),
  getRemoteUrl: (repoPath, remoteName = 'origin') => ipcRenderer.invoke('git:getRemoteUrl', repoPath, remoteName),
  aheadBehind: (repoPath) => ipcRenderer.invoke('git:aheadBehind', repoPath),
  fetch: (repoPath) => ipcRenderer.invoke('git:fetch', repoPath),
  pull: (repoPath) => ipcRenderer.invoke('git:pull', repoPath),
  addRemote: (repoPath, remoteName, remoteUrl) => ipcRenderer.invoke('git:addRemote', repoPath, remoteName, remoteUrl),

  // File system
  readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
  getHome: () => ipcRenderer.invoke('app:getHome'),

  // Recent repos
  getRecent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (path) => ipcRenderer.invoke('recent:add', path)
})
