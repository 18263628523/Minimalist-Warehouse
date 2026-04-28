import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  
  // Git operations
  isGitRepo: (path) => ipcRenderer.invoke('git:isRepo', path),
  initGit: (path) => ipcRenderer.invoke('git:init', path),
  getRemote: (path) => ipcRenderer.invoke('git:getRemote', path),
  getStatus: (path) => ipcRenderer.invoke('git:status', path),
  add: (path, files) => ipcRenderer.invoke('git:add', path, files),
  reset: (path, files) => ipcRenderer.invoke('git:reset', path, files),
  checkout: (path, files) => ipcRenderer.invoke('git:checkout', path, files),
  restore: (path, files) => ipcRenderer.invoke('git:restore', path, files),
  diff: (path, filePath) => ipcRenderer.invoke('git:diff', path, filePath),
  diffCached: (path, filePath) => ipcRenderer.invoke('git:diffCached', path, filePath),
  addToIgnore: (path, filePath) => ipcRenderer.invoke('git:addToIgnore', path, filePath),
  commit: (path, message) => ipcRenderer.invoke('git:commit', path, message),
  commitAmend: (path, message, noEdit) => ipcRenderer.invoke('git:commitAmend', path, message, noEdit),
  push: (path) => ipcRenderer.invoke('git:push', path),
  pushSetUpstream: (path, remote, branch) => ipcRenderer.invoke('git:pushSetUpstream', path, remote, branch),
  commitAndPush: (path, message) => ipcRenderer.invoke('git:commitAndPush', path, message),
  lastCommitMsg: (path) => ipcRenderer.invoke('git:lastCommitMsg', path),
  currentBranch: (path) => ipcRenderer.invoke('git:currentBranch', path),
  pull: (path) => ipcRenderer.invoke('git:pull', path),
  fetch: (path) => ipcRenderer.invoke('git:fetch', path),
  remoteBranches: (path) => ipcRenderer.invoke('git:remoteBranches', path),
  trackingBranch: (path) => ipcRenderer.invoke('git:trackingBranch', path),
  aheadBehind: (path) => ipcRenderer.invoke('git:aheadBehind', path),
  addRemote: (path, name, url) => ipcRenderer.invoke('git:addRemote', path, name, url),
  removeRemote: (path, name) => ipcRenderer.invoke('git:removeRemote', path, name),
  getRemoteUrl: (path, name) => ipcRenderer.invoke('git:getRemoteUrl', path, name),
  
  // File system
  readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
  getHome: () => ipcRenderer.invoke('app:getHome'),
  
  // Recent repos
  getRecent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (path) => ipcRenderer.invoke('recent:add', path)
})