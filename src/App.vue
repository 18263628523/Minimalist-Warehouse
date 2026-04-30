<template>
  <div class="app-container">
    <header class="header">
      <div class="header-left">
        <h1>{{ t('app.title') }}</h1>
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

      <div class="header-right">
        <div class="header-repo">
          <template v-if="currentRepo">
            <div class="repo-name" :title="currentRepo.path">{{ currentRepo.name }}</div>
            <div class="repo-meta">
              <span class="repo-status" :class="{ 'has-remote': hasRemote }">
                {{ hasRemote ? t('repo.linkedRemote') : t('repo.noRemote') }}
              </span>
              <span class="repo-path" :title="currentRepo.path">{{ currentRepo.path }}</span>
            </div>
          </template>
          <template v-else>
            <div class="repo-name empty">{{ t('repo.noSelection') }}</div>
            <div class="repo-meta">
              <span class="repo-status">{{ t('repo.openFirst') }}</span>
            </div>
          </template>
        </div>

        <label class="locale-label">
          <span class="sr-only">{{ t('language.label') }}</span>
          <select
            class="locale-select"
            :value="locale"
            @change="onLocaleChange($event.target.value)"
          >
            <option
              v-for="lang in languageOptions"
              :key="lang.value"
              :value="lang.value"
            >
              {{ lang.label }}
            </option>
          </select>
        </label>
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
          :title="t('panel.changesTitle')"
          :ready-text="t('panel.changesReady')"
          :current-repo="currentRepo"
          :has-remote="hasRemote"
          mode="changes"
          ref="statusPanelRef"
        />

        <BranchesPanel
          v-else-if="activeTab === 'branches'"
          :title="t('panel.branchesTitle')"
          :current-repo="currentRepo"
          :has-remote="hasRemote"
        />

        <StatusPanel
          v-else-if="activeTab === 'log'"
          :title="t('panel.logTitle')"
          :ready-text="t('panel.logReady')"
          :current-repo="currentRepo"
        />

        <SyncPanel
          v-else-if="activeTab === 'sync'"
          :title="t('panel.syncTitle')"
          :current-repo="currentRepo"
          @synced="loadRepoStatus"
        />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import RepoPanel from './components/RepoPanel.vue'
import StatusPanel from './components/StatusPanel.vue'
import SyncPanel from './components/SyncPanel.vue'
import BranchesPanel from './components/BranchesPanel.vue'
import { persistLocale } from './i18n'

const { t, locale } = useI18n()

const activeTab = ref('repo')
const currentRepo = ref(null)
const hasRemote = ref(false)
const recentRepos = ref([])
const statusPanelRef = ref(null)

const tabs = computed(() => [
  { id: 'repo', name: t('tabs.repo') },
  { id: 'changes', name: t('tabs.changes') },
  { id: 'branches', name: t('tabs.branches') },
  { id: 'log', name: t('tabs.log') },
  { id: 'sync', name: t('tabs.sync') }
])

const languageOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ko', label: '한국어' },
  { value: 'ja', label: '日本語' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' }
]

function onLocaleChange(code) {
  locale.value = code
  persistLocale(code)
}

// Open existing repository
async function openRepo() {
  if (!window.electronAPI) {
    alert(t('alerts.runInElectron'))
    return
  }
  
  const folderPath = await window.electronAPI.openFolder()
  if (!folderPath) return
  
  const isRepo = await window.electronAPI.isGitRepo(folderPath)
  if (!isRepo) {
    alert(t('alerts.notGitRepo'))
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
    alert(t('alerts.runInElectron'))
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
    alert(t('alerts.repoCreated'))
  } else {
    alert(t('alerts.createFailed', { msg: result.error }))
  }
}

// Switch to recent repo
async function switchToRepo(repo) {
  if (!window.electronAPI) return
  
  const isRepo = await window.electronAPI.isGitRepo(repo.path)
  if (!isRepo) {
    alert(t('alerts.folderNotGitAnymore'))
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

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  min-width: 0;
}

.locale-label {
  display: inline-flex;
  align-items: center;
}

.locale-select {
  background: #1e1e1e;
  color: #d4d4d4;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.locale-select:focus {
  outline: 1px solid #007fd4;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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