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
  
  // File system
  readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
  getHome: () => ipcRenderer.invoke('app:getHome'),
  
  // Recent repos
  getRecent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (path) => ipcRenderer.invoke('recent:add', path)
})