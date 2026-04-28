const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync, spawnSync } = require('child_process')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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

function runGit(repoPath, args) {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf-8',
    windowsHide: true
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || '').trim() || `git ${args.join(' ')} failed`
    const err = new Error(msg)
    err.code = result.status
    throw err
  }
  return (result.stdout || '').toString()
}

function parseStatusPorcelain(output) {
  const status = { modified: [], staged: [], untracked: [], deleted: [] }
  const lines = output.split('\n').map(l => l.trimEnd()).filter(Boolean)

  for (const line of lines) {
    // Format: XY<space>path  OR  ?? path
    const x = line[0]
    const y = line[1]
    let filePath = line.slice(3)

    // Renames: "R  old -> new" / "RM old -> new"
    const arrow = ' -> '
    const arrowIdx = filePath.indexOf(arrow)
    if (arrowIdx !== -1) {
      filePath = filePath.slice(arrowIdx + arrow.length)
    }

    if (x === '?' && y === '?') {
      status.untracked.push({ path: filePath, status: '??' })
      continue
    }

    const isDeleted = x === 'D' || y === 'D'
    if (isDeleted) {
      status.deleted.push({ path: filePath, status: `${x}${y}`.trim() })
      continue
    }

    if (x && x !== ' ') {
      status.staged.push({ path: filePath, status: x })
    }

    if (y && y !== ' ') {
      status.modified.push({ path: filePath, status: y })
    }
  }

  return status
}

ipcMain.handle('git:getStatus', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['status', '--porcelain=v1', '-uall'])
    return parseStatusPorcelain(output)
  } catch (error) {
    return { modified: [], staged: [], untracked: [], deleted: [], error: error.message }
  }
})

ipcMain.handle('git:add', async (event, repoPath, files = []) => {
  try {
    const args = ['add', '--']
    for (const f of files) args.push(f)
    runGit(repoPath, args)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:reset', async (event, repoPath, files = []) => {
  try {
    const args = ['reset', 'HEAD', '--']
    for (const f of files) args.push(f)
    runGit(repoPath, args)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:checkout', async (event, repoPath, files = []) => {
  try {
    const args = ['checkout', '--']
    for (const f of files) args.push(f)
    runGit(repoPath, args)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:diff', async (event, repoPath, filePath) => {
  try {
    return runGit(repoPath, ['diff', '--', filePath])
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:diffCached', async (event, repoPath, filePath) => {
  try {
    return runGit(repoPath, ['diff', '--cached', '--', filePath])
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:getFileVersions', async (event, repoPath, filePath) => {
  const absolutePath = path.join(repoPath, filePath)
  let localContent = ''
  let gitContent = ''

  try {
    if (fs.existsSync(absolutePath)) {
      localContent = fs.readFileSync(absolutePath, 'utf-8')
    } else {
      localContent = '(本地文件不存在或已删除)'
    }
  } catch (error) {
    localContent = `(无法读取本地文件: ${error.message})`
  }

  try {
    gitContent = runGit(repoPath, ['show', `HEAD:${filePath}`])
  } catch (error) {
    gitContent = '(Git 当前版本中不存在该文件)'
  }

  return { localContent, gitContent }
})

ipcMain.handle('git:addToIgnore', async (event, repoPath, filePath) => {
  try {
    const ignorePath = path.join(repoPath, '.gitignore')
    let content = ''
    if (fs.existsSync(ignorePath)) {
      content = fs.readFileSync(ignorePath, 'utf-8')
    }
    const lines = content.split(/\r?\n/)
    if (!lines.includes(filePath)) {
      const next = (content && !content.endsWith('\n')) ? content + '\n' : content
      fs.writeFileSync(ignorePath, next + filePath + '\n', 'utf-8')
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
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
    recent = recent.filter(r => r.path !== repoPath)
    recent.unshift({
      path: repoPath,
      name: path.basename(repoPath),
      lastOpened: Date.now()
    })
    recent = recent.slice(0, 10)
    fs.writeFileSync(recentReposPath, JSON.stringify(recent, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
