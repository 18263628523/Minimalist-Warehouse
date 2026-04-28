const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

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
