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

function pushWithAutoUpstream(repoPath) {
  const flow = []
  const appendOutput = (output) => {
    const text = String(output || '').trim()
    if (text) flow.push(text)
  }

  try {
    flow.push('执行: git push')
    const output = runGit(repoPath, ['push'])
    appendOutput(output)
    flow.push('结果: 推送成功')
    return { success: true, output: flow.join('\n') }
  } catch (error) {
    const raw = String(error?.message || '')
    const normalized = raw.toLowerCase()
    const noUpstream = normalized.includes('has no upstream branch')
    flow.push(`报错: ${raw}`)

    if (!noUpstream) {
      return { success: false, error: raw, output: flow.join('\n') }
    }

    try {
      const branch = runGit(repoPath, ['branch', '--show-current']).trim()
      if (!branch) {
        flow.push('结果: 未检测到当前分支，无法自动设置上游')
        return {
          success: false,
          error: '推送失败：当前不在有效分支上，无法自动设置上游分支。',
          output: flow.join('\n')
        }
      }
      flow.push(`检测到无上游分支，执行: git push -u origin ${branch}`)
      const output = runGit(repoPath, ['push', '-u', 'origin', branch])
      appendOutput(output)
      flow.push('结果: 推送成功（已自动设置上游分支）')
      return { success: true, output: flow.join('\n') }
    } catch (setUpstreamError) {
      const upErr = String(setUpstreamError?.message || '')
      flow.push(`自动设置上游失败: ${upErr}`)
      return {
        success: false,
        error: `推送失败：当前分支未设置上游分支，且自动设置失败：${upErr}`,
        output: flow.join('\n')
      }
    }
  }
}

function parseStatusPorcelain(output) {
  const status = { modified: [], staged: [], untracked: [], deleted: [] }
  const lines = output.split('\n').map(l => l.trimEnd()).filter(Boolean)

  for (const line of lines) {
    // Format: XY<space>path  OR  ?? path (porcelain v1)
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

    // Index (staged) + work tree must both be applied. Do not short-circuit on D:
    // e.g. "AD" is still staged as add while work tree shows deleted; "D " is a staged deletion.
    if (x !== ' ' && x !== '?') {
      status.staged.push({ path: filePath, status: x })
    }

    if (y === 'M') {
      status.modified.push({ path: filePath, status: y })
    } else if (y === 'D') {
      status.deleted.push({ path: filePath, status: `${x}${y}`.trim() })
    } else if (y === '?' || x === '?') {
      status.untracked.push({ path: filePath, status: y === '?' ? '??' : `${x}${y}`.trim() })
    }
  }

  return status
}

ipcMain.handle('git:getStatus', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-uall'])
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
    return runGit(repoPath, ['-c', 'core.quotepath=false', 'diff', '--', filePath])
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:diffCached', async (event, repoPath, filePath) => {
  try {
    return runGit(repoPath, ['-c', 'core.quotepath=false', 'diff', '--cached', '--', filePath])
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

ipcMain.handle('git:commit', async (event, repoPath, message) => {
  try {
    runGit(repoPath, ['commit', '-m', message])
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:commitAmend', async (event, repoPath, message, noEdit = false) => {
  try {
    if (noEdit) {
      runGit(repoPath, ['commit', '--amend', '--no-edit'])
    } else {
      runGit(repoPath, ['commit', '--amend', '-m', message])
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:push', async (event, repoPath) => {
  const result = pushWithAutoUpstream(repoPath)
  if (result.success) return { success: true, output: result.output }
  return { success: false, error: result.error }
})

ipcMain.handle('git:pushSetUpstream', async (event, repoPath, remote, branch) => {
  try {
    runGit(repoPath, ['push', '-u', remote, branch])
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:commitAndPush', async (event, repoPath, message) => {
  try {
    runGit(repoPath, ['commit', '-m', message])
    const pushResult = pushWithAutoUpstream(repoPath)
    if (!pushResult.success) {
      return { success: false, error: pushResult.error }
    }
    return { success: true, output: pushResult.output }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:lastCommitMsg', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['log', '-1', '--pretty=%B'])
    return output.trim()
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:currentBranch', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['branch', '--show-current'])
    return output.trim()
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:trackingBranch', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    return output.trim()
  } catch (error) {
    return ''
  }
})

// Get list of local branches
ipcMain.handle('git:branches', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, [
      'for-each-ref',
      '--format=%(refname:short)',
      'refs/heads'
    ])
    return output
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
  } catch (error) {
    return []
  }
})

// Get list of remote branches (e.g. origin/main)
ipcMain.handle('git:remoteBranches', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, [
      'for-each-ref',
      '--format=%(refname:short)',
      'refs/remotes'
    ])

    return output
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      // Filter out the symbolic HEAD entry like "origin/HEAD"
      .filter(b => !b.endsWith('/HEAD'))
  } catch (error) {
    return []
  }
})

// Switch branch (git switch with fallback to git checkout)
ipcMain.handle('git:switchBranch', async (event, repoPath, branchName) => {
  try {
    runGit(repoPath, ['switch', branchName])
    return { success: true }
  } catch (error) {
    try {
      runGit(repoPath, ['checkout', branchName])
      return { success: true }
    } catch (fallbackError) {
      return { success: false, error: fallbackError.message }
    }
  }
})

// Create local branch
ipcMain.handle('git:createBranch', async (event, repoPath, branchName, baseBranch = null) => {
  try {
    if (baseBranch) {
      runGit(repoPath, ['switch', '-c', branchName, baseBranch])
    } else {
      runGit(repoPath, ['switch', '-c', branchName])
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Delete local branch
ipcMain.handle('git:deleteBranch', async (event, repoPath, branchName, force = false) => {
  try {
    const flag = force ? '-D' : '-d'
    runGit(repoPath, ['branch', flag, branchName])
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Delete remote branch (remoteName: origin, branchName: main)
ipcMain.handle('git:deleteRemoteBranch', async (event, repoPath, remoteName, branchName) => {
  try {
    runGit(repoPath, ['push', remoteName, '--delete', branchName])
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Merge branches: checkout target then merge source into it
ipcMain.handle('git:mergeBranches', async (event, repoPath, targetBranch, sourceBranch) => {
  try {
    runGit(repoPath, ['switch', targetBranch])
    const output = runGit(repoPath, ['merge', sourceBranch])
    return { success: true, output: output.trim() }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Rebase branches: checkout branch then rebase onto ontoBranch
ipcMain.handle('git:rebaseBranches', async (event, repoPath, branchToRebase, ontoBranch) => {
  try {
    runGit(repoPath, ['switch', branchToRebase])
    const output = runGit(repoPath, ['rebase', ontoBranch])
    return { success: true, output: output.trim() }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Diff between two branches (content diff)
ipcMain.handle('git:diffBranches', async (event, repoPath, baseBranch, compareBranch) => {
  try {
    return runGit(repoPath, ['-c', 'core.quotepath=false', 'diff', `${baseBranch}...${compareBranch}`])
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:getRemoteUrl', async (event, repoPath, remoteName = 'origin') => {
  try {
    const output = runGit(repoPath, ['remote', 'get-url', remoteName])
    return output.trim()
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:aheadBehind', async (event, repoPath) => {
  try {
    // Output: "<behind> <ahead>" for "@{u}...HEAD" with --left-right
    const output = runGit(repoPath, ['rev-list', '--left-right', '--count', '@{u}...HEAD']).trim()
    const [behindStr = '0', aheadStr = '0'] = output.split(/\s+/)
    return {
      ahead: Number(aheadStr) || 0,
      behind: Number(behindStr) || 0
    }
  } catch (error) {
    return { ahead: 0, behind: 0 }
  }
})

ipcMain.handle('git:unpushedFiles', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['diff', '--name-only', '@{u}..HEAD'])
    const files = output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    return { success: true, files }
  } catch (error) {
    const raw = String(error?.message || '')
    if (raw.toLowerCase().includes('no upstream configured for branch')) {
      return { success: true, files: [], note: '当前分支未设置上游分支，暂无法计算未推送文件。' }
    }
    return { success: false, error: raw, files: [] }
  }
})

ipcMain.handle('git:fetch', async (event, repoPath) => {
  try {
    const output = runGit(repoPath, ['fetch', '--prune'])
    return { success: true, output }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:pull', async (event, repoPath) => {
  const isDivergentPullError = (msg) => {
    const text = String(msg || '').toLowerCase()
    return text.includes('need to specify how to reconcile divergent branches')
  }
  const isUnrelatedHistoriesError = (msg) => {
    const text = String(msg || '').toLowerCase()
    return text.includes('refusing to merge unrelated histories')
  }
  const flow = []
  const appendOutput = (output) => {
    const text = String(output || '').trim()
    if (text) flow.push(text)
  }

  try {
    flow.push('执行: git pull')
    const output = runGit(repoPath, ['pull'])
    appendOutput(output)
    flow.push('结果: 拉取成功')
    return { success: true, output: flow.join('\n') }
  } catch (error) {
    const raw = String(error?.message || '')
    const normalized = raw.toLowerCase()
    const noTracking = normalized.includes('there is no tracking information for the current branch')
    flow.push(`报错: ${raw}`)

    if (noTracking) {
      try {
        flow.push('检测到无上游分支，准备读取当前分支')
        const branch = runGit(repoPath, ['branch', '--show-current']).trim()
        if (branch) {
          // 默认使用 merge 策略，避免在未配置 pull.rebase 时因分叉而失败
          flow.push(`执行: git pull --no-rebase origin ${branch}`)
          const output = runGit(repoPath, ['pull', '--no-rebase', 'origin', branch])
          appendOutput(output)
          flow.push('结果: 拉取成功（已使用 origin + 当前分支）')
          return { success: true, output: flow.join('\n') }
        }
      } catch (fallbackError) {
        const fallbackMsg = String(fallbackError?.message || '')
        flow.push(`自动拉取 origin 失败: ${fallbackMsg}`)
        if (isUnrelatedHistoriesError(fallbackMsg)) {
          try {
            const branch = runGit(repoPath, ['branch', '--show-current']).trim()
            if (branch) {
              flow.push(`执行: git pull --no-rebase --allow-unrelated-histories origin ${branch}`)
              const output = runGit(repoPath, ['pull', '--no-rebase', '--allow-unrelated-histories', 'origin', branch])
              appendOutput(output)
              flow.push('结果: 拉取成功（允许 unrelated histories）')
              return { success: true, output: flow.join('\n') }
            }
          } catch (retryError) {
            const retryMsg = String(retryError?.message || '')
            flow.push(`重试失败: ${retryMsg}`)
            return {
              success: false,
              error: `本地与远程历史无共同祖先，自动合并失败：${retryMsg}。请确认这是你期望合并的两个历史后再操作。`,
              output: flow.join('\n')
            }
          }
        }
        if (isDivergentPullError(fallbackMsg)) {
          flow.push('结果: 分支已分叉，自动拉取中止')
          return {
            success: false,
            error: '本地与远程分支已分叉，自动拉取失败。请先处理分叉（建议先提交当前改动），再执行拉取并解决冲突。',
            output: flow.join('\n')
          }
        }
        return {
          success: false,
          error: `当前分支未设置上游分支，自动拉取 origin 失败：${fallbackMsg}。请先执行：git push -u origin <分支名> 或 git branch --set-upstream-to=origin/<分支名> <分支名>`,
          output: flow.join('\n')
        }
      }

      flow.push('结果: 未读取到当前分支，无法自动指定 origin/<branch>')
      return {
        success: false,
        error: '当前分支未设置上游分支。请先执行：git push -u origin <分支名> 或 git branch --set-upstream-to=origin/<分支名> <分支名>',
        output: flow.join('\n')
      }
    }

    if (isDivergentPullError(raw)) {
      try {
        flow.push('检测到分支分叉，执行: git pull --no-rebase')
        const output = runGit(repoPath, ['pull', '--no-rebase'])
        appendOutput(output)
        flow.push('结果: 拉取成功（已按 merge 策略）')
        return { success: true, output: flow.join('\n') }
      } catch (retryError) {
        const retryMsg = String(retryError?.message || '')
        flow.push(`重试失败: ${retryMsg}`)
        return {
          success: false,
          error: `本地与远程分支已分叉，自动按 merge 策略拉取失败：${retryMsg}`,
          output: flow.join('\n')
        }
      }
    }

    if (isUnrelatedHistoriesError(raw)) {
      try {
        flow.push('检测到 unrelated histories，执行: git pull --no-rebase --allow-unrelated-histories')
        const output = runGit(repoPath, ['pull', '--no-rebase', '--allow-unrelated-histories'])
        appendOutput(output)
        flow.push('结果: 拉取成功（允许 unrelated histories）')
        return { success: true, output: flow.join('\n') }
      } catch (retryError) {
        const retryMsg = String(retryError?.message || '')
        flow.push(`重试失败: ${retryMsg}`)
        return {
          success: false,
          error: `本地与远程历史无共同祖先，自动合并失败：${retryMsg}。请确认这是你期望合并的两个历史后再操作。`,
          output: flow.join('\n')
        }
      }
    }

    return { success: false, error: raw, output: flow.join('\n') }
  }
})

ipcMain.handle('git:addRemote', async (event, repoPath, remoteName, remoteUrl) => {
  try {
    runGit(repoPath, ['remote', 'add', remoteName, remoteUrl])
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
