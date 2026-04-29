<template>
  <div class="app-container">
    <header class="header">
      <div class="header-left">
        <h1>Git Client</h1>
        <nav class="top-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['top-tab', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>
        </nav>
      </div>

      <div class="header-repo">
        <template v-if="currentRepo">
          <div class="repo-name" :title="currentRepo.path">{{ currentRepo.name }}</div>
          <div class="repo-meta">
            <span class="repo-status" :class="{ 'has-remote': hasRemote }">
              {{ hasRemote ? '已关联远程' : '未关联远程' }}
            </span>
            <span class="repo-path" :title="currentRepo.path">{{ currentRepo.path }}</span>
          </div>
        </template>
        <template v-else>
          <div class="repo-name empty">未选择仓库</div>
          <div class="repo-meta">
            <span class="repo-status">请先打开仓库</span>
          </div>
        </template>
      </div>
    </header>
    <div class="main-content">
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
          :has-remote="hasRemote"
          mode="changes"
          ref="statusPanelRef"
        />

        <BranchesPanel
          v-else-if="activeTab === 'branches'"
          title="分支管理"
          :current-repo="currentRepo"
          :has-remote="hasRemote"
        />

        <StatusPanel
          v-else-if="activeTab === 'log'"
          title="提交历史"
          ready-text="暂无提交记录"
          :current-repo="currentRepo"
        />

        <SyncPanel
          v-else-if="activeTab === 'sync'"
          title="远程同步"
          :current-repo="currentRepo"
          @synced="loadRepoStatus"
        />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import RepoPanel from './components/RepoPanel.vue'
import StatusPanel from './components/StatusPanel.vue'
import SyncPanel from './components/SyncPanel.vue'
import BranchesPanel from './components/BranchesPanel.vue'

const activeTab = ref('repo')
const currentRepo = ref(null)
const hasRemote = ref(false)
const recentRepos = ref([])
const statusPanelRef = ref(null)

const tabs = [
  { id: 'repo', name: '仓库' },
  { id: 'changes', name: '变更' },
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

// Refresh repo status after commit
async function loadRepoStatus() {
  if (statusPanelRef.value) {
    statusPanelRef.value.refreshStatus()
  }
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
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 64px;
  box-sizing: border-box;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.header h1 {
  font-size: 18px;
  font-weight: 500;
  white-space: nowrap;
}

.top-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  min-width: 0;
}

.top-tab {
  background: transparent;
  border: 1px solid transparent;
  color: #d4d4d4;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.top-tab:hover {
  background: #2a2d2e;
}

.top-tab.active {
  background: #37373d;
  border-color: #3c3c3c;
}

.header-repo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 240px;
  max-width: 520px;
  padding: 6px 10px;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  height: 52px;
  justify-content: center;
}

.repo-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-name.empty {
  color: #888;
}

.repo-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  height: 16px;
}

.repo-status {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.repo-status.has-remote {
  color: #4ec9b0;
}

.repo-path {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
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