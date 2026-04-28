<template>
  <div class="app-container">
    <header class="header">
      <h1>Git Client</h1>
    </header>
    <div class="main-content">
      <AppSidebar
        :tabs="tabs"
        :active-tab="activeTab"
        :current-repo="currentRepo"
        :has-remote="hasRemote"
        @change-tab="activeTab = $event"
      />

      <main class="content">
        <RepoPanel
          v-if="activeTab === 'repo'"
          :current-repo="currentRepo"
          :has-remote="hasRemote"
          :recent-repos="recentRepos"
          @open-repo="openRepo"
          @create-repo="createNewRepo"
          @switch-repo="switchToRepo"
        />

        <StatusPanel
          v-else-if="activeTab === 'changes'"
          title="文件变更"
          ready-text="暂无可用变更"
          :current-repo="currentRepo"
        />

        <StatusPanel
          v-else-if="activeTab === 'commit'"
          title="提交"
          ready-text=""
          :current-repo="currentRepo"
          mode="textarea"
        />

        <StatusPanel
          v-else-if="activeTab === 'branches'"
          title="分支管理"
          ready-text="暂无分支"
          :current-repo="currentRepo"
        />

        <StatusPanel
          v-else-if="activeTab === 'log'"
          title="提交历史"
          ready-text="暂无提交记录"
          :current-repo="currentRepo"
        />

        <StatusPanel
          v-else-if="activeTab === 'sync'"
          title="远程同步"
          ready-text=""
          :current-repo="currentRepo"
          mode="sync"
        />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import RepoPanel from './components/RepoPanel.vue'
import StatusPanel from './components/StatusPanel.vue'

const activeTab = ref('repo')
const currentRepo = ref(null)
const hasRemote = ref(false)
const recentRepos = ref([])

const tabs = [
  { id: 'repo', name: '仓库' },
  { id: 'changes', name: '变更' },
  { id: 'commit', name: '提交' },
  { id: 'branches', name: '分支' },
  { id: 'log', name: '日志' },
  { id: 'sync', name: '同步' }
]

// Open existing repository
async function openRepo() {
  if (!window.electronAPI) {
    alert('请在 Electron 环境中运行')
    return
  }
  
  const folderPath = await window.electronAPI.openFolder()
  if (!folderPath) return
  
  const isRepo = await window.electronAPI.isGitRepo(folderPath)
  if (!isRepo) {
    alert('选择的文件夹不是 Git 仓库')
    return
  }
  
  const name = folderPath.split('/').pop()
  currentRepo.value = { path: folderPath, name }
  
  // Get remote info
  const remote = await window.electronAPI.getRemote(folderPath)
  hasRemote.value = !!remote
  
  // Add to recent
  await window.electronAPI.addRecent(folderPath)
  loadRecentRepos()
}

// Create new repository
async function createNewRepo() {
  if (!window.electronAPI) {
    alert('请在 Electron 环境中运行')
    return
  }
  
  const folderPath = await window.electronAPI.openFolder()
  if (!folderPath) return
  
  const result = await window.electronAPI.initGit(folderPath)
  
  if (result.success) {
    const name = folderPath.split('/').pop()
    currentRepo.value = { path: folderPath, name }
    hasRemote.value = false
    await window.electronAPI.addRecent(folderPath)
    loadRecentRepos()
    alert('仓库创建成功！')
  } else {
    alert('创建失败: ' + result.error)
  }
}

// Switch to recent repo
async function switchToRepo(repo) {
  if (!window.electronAPI) return
  
  const isRepo = await window.electronAPI.isGitRepo(repo.path)
  if (!isRepo) {
    alert('该文件夹不再是 Git 仓库')
    loadRecentRepos()
    return
  }
  
  currentRepo.value = repo
  const remote = await window.electronAPI.getRemote(repo.path)
  hasRemote.value = !!remote
  
  await window.electronAPI.addRecent(repo.path)
}

// Load recent repos
async function loadRecentRepos() {
  if (!window.electronAPI) return
  recentRepos.value = await window.electronAPI.getRecent()
}

onMounted(() => {
  loadRecentRepos()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e1e;
  color: #d4d4d4;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header {
  padding: 16px 24px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
}

.header h1 {
  font-size: 18px;
  font-weight: 500;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}
</style>