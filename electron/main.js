import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { app, BrowserWindow, ipcMain, dialog } = require('electron')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers for Git operations

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Check if folder is a git repository
ipcMain.handle('git:isRepo', async (event, repoPath) => {
  try {
    const gitDir = path.join(repoPath, '.git')
    return fs.existsSync(gitDir)
  } catch (error) {
    return false
  }
})

// Initialize a new git repository
ipcMain.handle('git:init', async (event, repoPath) => {
  try {
    execSync('git init', { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Get remote info
ipcMain.handle('git:getRemote', async (event, repoPath) => {
  try {
    const output = execSync('git remote -v', { cwd: repoPath, encoding: 'utf-8' })
    return output.trim() || null
  } catch (error) {
    return null
  }
})

// Get list of files in directory
ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile()
    }))
  } catch (error) {
    return []
  }
})

// Get home directory for recent repos
ipcMain.handle('app:getHome', () => {
  return app.getPath('home')
})

// Store recent repos
const recentReposPath = path.join(app.getPath('userData'), 'recent-repos.json')

ipcMain.handle('recent:get', () => {
  try {
    if (fs.existsSync(recentReposPath)) {
      return JSON.parse(fs.readFileSync(recentReposPath, 'utf-8'))
    }
  } catch (error) {}
  return []
})

ipcMain.handle('recent:add', (event, repoPath) => {
  try {
    let recent = []
    if (fs.existsSync(recentReposPath)) {
      recent = JSON.parse(fs.readFileSync(recentReposPath, 'utf-8'))
    }
    // Remove if exists, add to front
    recent = recent.filter(r => r.path !== repoPath)
    recent.unshift({
      path: repoPath,
      name: path.basename(repoPath),
      lastOpened: Date.now()
    })
    // Keep only 10
    recent = recent.slice(0, 10)
    fs.writeFileSync(recentReposPath, JSON.stringify(recent, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Get git status - all changed files
ipcMain.handle('git:status', async (event, repoPath) => {
  try {
    const output = execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf-8' })
    const files = {
      modified: [],
      staged: [],
      untracked: [],
      deleted: []
    }
    
    if (!output.trim()) return files
    
    const lines = output.trim().split('\n')
    for (const line of lines) {
      const indexStatus = line.charAt(0)
      const workTreeStatus = line.charAt(1)
      const filePath = line.substring(3).trim()
      
      // Parse file status
      // X          Y           meaning
      // [M]       [M]         modified in index, modified in work tree
      // [A]       [ ]         added to index
      // [D]       [D]         deleted from index, deleted in work tree
      // [R]       [R]         renamed in index, renamed in work tree
      // [?]        [?]         untracked
      // [!]        [!]         ignored
      
      // Staged files (index)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        files.staged.push({ path: filePath, status: indexStatus })
      }
      
      // Work tree changes
      if (workTreeStatus === 'M') {
        files.modified.push({ path: filePath })
      } else if (workTreeStatus === 'D') {
        files.deleted.push({ path: filePath })
      } else if (workTreeStatus === '?' || indexStatus === '?') {
        files.untracked.push({ path: filePath })
      }
    }
    
    return files
  } catch (error) {
    return { modified: [], staged: [], untracked: [], deleted: [] }
  }
})

// Git add file(s)
ipcMain.handle('git:add', async (event, repoPath, files) => {
  try {
    if (files && files.length > 0) {
      execSync('git add ' + files.map(f => '"' + f + '"').join(' '), { cwd: repoPath, encoding: 'utf-8' })
    } else {
      execSync('git add .', { cwd: repoPath, encoding: 'utf-8' })
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git reset file(s) - unstage
ipcMain.handle('git:reset', async (event, repoPath, files) => {
  try {
    if (files && files.length > 0) {
      execSync('git reset HEAD -- ' + files.map(f => '"' + f + '"').join(' '), { cwd: repoPath, encoding: 'utf-8' })
    } else {
      execSync('git reset HEAD', { cwd: repoPath, encoding: 'utf-8' })
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git checkout/restore file(s) - discard changes
ipcMain.handle('git:checkout', async (event, repoPath, files) => {
  try {
    execSync('git checkout -- ' + files.map(f => '"' + f + '"').join(' '), { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git restore file(s) - staged changes
ipcMain.handle('git:restore', async (event, repoPath, files) => {
  try {
    execSync('git restore --staged ' + files.map(f => '"' + f + '"').join(' '), { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git diff file
ipcMain.handle('git:diff', async (event, repoPath, filePath) => {
  try {
    const output = execSync('git diff ' + (filePath ? '"' + filePath + '"' : ''), { cwd: repoPath, encoding: 'utf-8' })
    return output
  } catch (error) {
    return ''
  }
})

// Git diff --cached file (staged)
ipcMain.handle('git:diffCached', async (event, repoPath, filePath) => {
  try {
    const output = execSync('git diff --cached ' + (filePath ? '"' + filePath + '"' : ''), { cwd: repoPath, encoding: 'utf-8' })
    return output
  } catch (error) {
    return ''
  }
})

// Add to .gitignore
ipcMain.handle('git:addToIgnore', async (event, repoPath, filePath) => {
  try {
    const gitignorePath = path.join(repoPath, '.gitignore')
    const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : ''
    
    if (!content.includes(filePath)) {
      fs.writeFileSync(gitignorePath, content + '\n' + filePath + '\n')
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git commit
ipcMain.handle('git:commit', async (event, repoPath, message) => {
  try {
    execSync('git commit -m "' + message.replace(/"/g, '\\"') + '"', { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git commit with amend
ipcMain.handle('git:commitAmend', async (event, repoPath, message, noEdit = false) => {
  try {
    const cmd = noEdit ? 'git commit --amend --no-edit' : 'git commit -m "' + message.replace(/"/g, '\\"') + '" --amend'
    execSync(cmd, { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git push
ipcMain.handle('git:push', async (event, repoPath) => {
  try {
    execSync('git push', { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git push with set upstream
ipcMain.handle('git:pushSetUpstream', async (event, repoPath, remote, branch) => {
  try {
    execSync('git push -u ' + remote + ' ' + branch, { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git commit and push
ipcMain.handle('git:commitAndPush', async (event, repoPath, message) => {
  try {
    // First commit
    execSync('git commit -m "' + message.replace(/"/g, '\\"') + '"', { cwd: repoPath, encoding: 'utf-8' })
    // Then push
    execSync('git push', { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Get last commit message (for amend reference)
ipcMain.handle('git:lastCommitMsg', async (event, repoPath) => {
  try {
    const output = execSync('git log -1 --pretty=%B', { cwd: repoPath, encoding: 'utf-8' })
    return output.trim()
  } catch (error) {
    return ''
  }
})

// Get current branch name
ipcMain.handle('git:currentBranch', async (event, repoPath) => {
  try {
    const output = execSync('git branch --show-current', { cwd: repoPath, encoding: 'utf-8' })
    return output.trim()
  } catch (error) {
    return ''
  }
})

// Git pull
ipcMain.handle('git:pull', async (event, repoPath) => {
  try {
    execSync('git pull', { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Git fetch
ipcMain.handle('git:fetch', async (event, repoPath) => {
  try {
    execSync('git fetch --all', { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Get remote branches
ipcMain.handle('git:remoteBranches', async (event, repoPath) => {
  try {
    const output = execSync('git branch -r', { cwd: repoPath, encoding: 'utf-8' })
    const branches = output.trim().split('\n').filter(b => b.trim())
    return branches
  } catch (error) {
    return []
  }
})

// Get tracking branch info
ipcMain.handle('git:trackingBranch', async (event, repoPath) => {
  try {
    const output = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: repoPath, encoding: 'utf-8' })
    return output.trim()
  } catch (error) {
    return ''
  }
})

// Get ahead/behind count
ipcMain.handle('git:aheadBehind', async (event, repoPath) => {
  try {
    const output = execSync('git rev-list --left-right --count @{u}...HEAD', { cwd: repoPath, encoding: 'utf-8' })
    const [behind, ahead] = output.trim().split('\t').map(Number)
    return { ahead, behind }
  } catch (error) {
    return { ahead: 0, behind: 0 }
  }
})

// Add remote
ipcMain.handle('git:addRemote', async (event, repoPath, name, url) => {
  try {
    execSync('git remote add ' + name + ' ' + url, { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Remove remote
ipcMain.handle('git:removeRemote', async (event, repoPath, name) => {
  try {
    execSync('git remote remove ' + name, { cwd: repoPath, encoding: 'utf-8' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Get remote URL
ipcMain.handle('git:getRemoteUrl', async (event, repoPath, remoteName) => {
  try {
    const output = execSync('git remote get-url ' + (remoteName || 'origin'), { cwd: repoPath, encoding: 'utf-8' })
    return output.trim()
  } catch (error) {
    return ''
  }
})