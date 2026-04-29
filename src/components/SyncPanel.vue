<template>
  <div class="panel">
    <h2>{{ title }}</h2>

    <p v-if="!currentRepo" class="no-repo">
      请先在「仓库管理」中打开一个 Git 仓库
    </p>

    <template v-else>
      <!-- Remote Info -->
      <div class="remote-info">
        <div class="remote-header">
          <h3>远程仓库</h3>
          <button @click="refreshRemote" :disabled="isRefreshing" class="btn-small btn-refresh">
            <span :class="['refresh-icon', { spinning: isRefreshing }]">🔄</span>
            <span>{{ isRefreshing ? '刷新中...' : '刷新' }}</span>
          </button>
        </div>

        <div v-if="hasRemote" class="remote-detail">
          <div class="detail-row">
            <span class="label">远程:</span>
            <span class="value">{{ currentBranch }}</span>
          </div>
          <div class="detail-row">
            <span class="label">跟踪:</span>
            <span class="value">{{ trackingBranch }}</span>
          </div>
          <div class="detail-row">
            <span class="label">URL:</span>
            <span class="value url">{{ remoteUrl }}</span>
          </div>
          
          <!-- Ahead/Behind -->
          <div class="sync-status">
            <div class="status-item ahead">
              <span class="count">{{ aheadBehind.ahead }}</span>
              <span class="label">↑ 本地领先</span>
            </div>
            <div class="status-item behind">
              <span class="count">{{ aheadBehind.behind }}</span>
              <span class="label">↓ 远程领先</span>
            </div>
          </div>

          <div v-if="unpushedFiles.length > 0" class="unpushed-files">
            <div class="unpushed-title">未推送文件 ({{ unpushedFiles.length }})</div>
            <ul>
              <li v-for="file in unpushedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>
          <p v-else-if="unpushedNote" class="unpushed-note">{{ unpushedNote }}</p>
        </div>

        <div v-else class="no-remote">
          <p>未关联远程仓库</p>
          <button @click="showAddRemote = true" class="btn-primary" :disabled="isAnyActionLoading">
            {{ isAnyActionLoading ? '处理中...' : '+ 添加远程' }}
          </button>
        </div>
      </div>

      <!-- Add Remote Form -->
      <div v-if="showAddRemote" class="add-remote-form">
        <h3>添加远程仓库</h3>
        <div class="form-group">
          <label>名称</label>
          <input v-model="newRemoteName" placeholder="origin" />
        </div>
        <div class="form-group">
          <label>URL</label>
          <input v-model="newRemoteUrl" placeholder="https://github.com/user/repo.git" />
        </div>
        <div class="form-actions">
          <button @click="doAddRemote" class="btn-primary" :disabled="isAddRemoteLoading">
            {{ isAddRemoteLoading ? '添加中...' : '添加' }}
          </button>
          <button @click="showAddRemote = false" :disabled="isAddRemoteLoading">取消</button>
        </div>
      </div>

      <!-- Sync Actions -->
      <div class="sync-actions">
        <h3>同步操作</h3>
        
        <div class="action-buttons">
          <div class="action-group">
            <button 
              @click="doFetch" 
              :disabled="isAnyActionLoading"
              class="btn-fetch"
            >
              {{ isActionLoading('fetch') ? '获取中...' : '📥 获取 (fetch)' }}
            </button>
            <p class="hint">获取远程更新，不合并</p>
          </div>

          <div class="action-group">
            <button 
              @click="doPull" 
              :disabled="isAnyActionLoading || !hasRemote"
              class="btn-pull"
            >
              {{ isActionLoading('pull') ? '拉取中...' : '⬇️ 拉取 (pull)' }}
            </button>
            <p class="hint">拉取并合并远程更改</p>
          </div>

          <div class="action-group">
            <button 
              @click="doPush" 
              :disabled="isAnyActionLoading || !hasRemote"
              class="btn-push"
            >
              {{ isActionLoading('push') ? '推送中...' : '⬆️ 推送 (push)' }}
            </button>
            <p class="hint">推送到远程仓库</p>
          </div>
        </div>
      </div>

      <!-- Progress/Result -->
      <div v-if="showProgress" class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }">
          {{ progressPercent }}%
        </div>
      </div>

      <div v-if="syncResult" class="sync-result" :class="{ success: syncResult.success, error: !syncResult.success }">
        <template v-if="syncResult.success">
          <p>✓ 操作成功!</p>
          <pre v-if="syncResult.output" class="output">{{ syncResult.output }}</pre>
        </template>
        <template v-else>
          <p class="error-title">✕ 操作失败</p>
          <p class="error-message">{{ syncResult.error }}</p>
          <pre v-if="syncResult.output" class="output">{{ syncResult.output }}</pre>
          <!-- Parse common errors -->
          <div v-if="isConflictError" class="error-hint">
            <p>检测到冲突!请:</p>
            <ol>
              <li>查看冲突文件 (在「变更」标签)</li>
              <li>手动解决冲突</li>
              <li>再次暂存并提交</li>
            </ol>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  currentRepo: { type: Object, default: null },
  hasRemoteProp: { type: Boolean, default: true }
})

const emit = defineEmits(['synced'])

const currentBranch = ref('')
const trackingBranch = ref('')
const remoteUrl = ref('')
const aheadBehind = ref({ ahead: 0, behind: 0 })
const unpushedFiles = ref([])
const unpushedNote = ref('')
const activeAction = ref('')
const isRefreshing = ref(false)
const syncResult = ref(null)
const showProgress = ref(false)
const progressPercent = ref(0)
const showAddRemote = ref(false)
const newRemoteName = ref('origin')
const newRemoteUrl = ref('')

const hasRemote = computed(() => !!remoteUrl.value)
const isAnyActionLoading = computed(() => activeAction.value !== '')
const isAddRemoteLoading = computed(() => activeAction.value === 'addRemote')

const isConflictError = computed(() => {
  if (!syncResult.value || syncResult.value.success) return false
  const error = syncResult.value.error || ''
  return error.includes('conflict') || error.includes('CONFLICT')
})

function isActionLoading(action) {
  return activeAction.value === action
}

// Load remote info
async function loadRemoteInfo() {
  if (!props.currentRepo || !window.electronAPI) return

  currentBranch.value = await window.electronAPI.currentBranch(props.currentRepo.path)
  
  try {
    trackingBranch.value = await window.electronAPI.trackingBranch(props.currentRepo.path)
    remoteUrl.value = await window.electronAPI.getRemoteUrl(props.currentRepo.path, 'origin')
    aheadBehind.value = await window.electronAPI.aheadBehind(props.currentRepo.path)
    const unpushed = await window.electronAPI.unpushedFiles(props.currentRepo.path)
    if (unpushed?.success) {
      unpushedFiles.value = unpushed.files || []
      unpushedNote.value = unpushed.note || ''
    } else {
      unpushedFiles.value = []
      unpushedNote.value = ''
    }
  } catch (e) {
    trackingBranch.value = ''
    remoteUrl.value = ''
    aheadBehind.value = { ahead: 0, behind: 0 }
    unpushedFiles.value = []
    unpushedNote.value = ''
  }
}

// Refresh
async function refreshRemote() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  syncResult.value = null
  try {
    await loadRemoteInfo()
  } finally {
    isRefreshing.value = false
  }
}

// Fetch
async function doFetch() {
  if (!window.electronAPI) return
  
  activeAction.value = 'fetch'
  showProgress.value = true
  progressPercent.value = 30
  syncResult.value = null

  const result = await window.electronAPI.fetch(props.currentRepo.path)
  
  progressPercent.value = 100
  
  if (result.success) {
    syncResult.value = { success: true, output: '已获取远程更新' }
    await loadRemoteInfo()
    emit('synced')
  } else {
    syncResult.value = result
  }
  
  activeAction.value = ''
  setTimeout(() => { showProgress.value = false }, 2000)
}

// Pull
async function doPull() {
  if (!window.electronAPI) return
  
  activeAction.value = 'pull'
  showProgress.value = true
  progressPercent.value = 0
  syncResult.value = null

  // Simple progress simulation
  const interval = setInterval(() => {
    if (progressPercent.value < 80) {
      progressPercent.value += 20
    }
  }, 500)

  const result = await window.electronAPI.pull(props.currentRepo.path)
  
  clearInterval(interval)
  progressPercent.value = 100
  
  if (result.success) {
    syncResult.value = { success: true, output: result.output || '已拉取并合并远程更改' }
    await loadRemoteInfo()
    emit('synced')
  } else {
    syncResult.value = result
  }
  
  activeAction.value = ''
  setTimeout(() => { showProgress.value = false }, 2000)
}

// Push
async function doPush() {
  if (!window.electronAPI) return
  
  activeAction.value = 'push'
  showProgress.value = true
  progressPercent.value = 0
  syncResult.value = null

  const interval = setInterval(() => {
    if (progressPercent.value < 80) {
      progressPercent.value += 20
    }
  }, 500)

  const result = await window.electronAPI.push(props.currentRepo.path)
  
  clearInterval(interval)
  progressPercent.value = 100
  
  if (result.success) {
    syncResult.value = { success: true, output: result.output || '已推送到远程仓库' }
    await loadRemoteInfo()
  } else {
    syncResult.value = result
  }
  
  activeAction.value = ''
  setTimeout(() => { showProgress.value = false }, 2000)
}

// Add remote
async function doAddRemote() {
  if (!window.electronAPI || !newRemoteName.value || !newRemoteUrl.value) return
  
  activeAction.value = 'addRemote'
  const result = await window.electronAPI.addRemote(
    props.currentRepo.path,
    newRemoteName.value,
    newRemoteUrl.value
  )
  
  if (result.success) {
    showAddRemote.value = false
    newRemoteName.value = 'origin'
    newRemoteUrl.value = ''
    await loadRemoteInfo()
    emit('synced')
  } else {
    alert('添加失败: ' + result.error)
  }
  activeAction.value = ''
}

// Watch for repo changes
watch(() => props.currentRepo, () => {
  if (props.currentRepo) {
    loadRemoteInfo()
  }
}, { immediate: true })
</script>

<style scoped>
.panel h2 {
  font-size: 18px;
  margin-bottom: 20px;
}

.no-repo {
  color: #888;
  font-style: italic;
}

/* Remote Info */
.remote-info {
  background: #252526;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.remote-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.remote-header h3 {
  font-size: 14px;
  color: #969696;
}

.btn-small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #3c3c3c;
  color: #d4d4d4;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-small:hover {
  background: #4c4c4c;
}

.btn-refresh:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.refresh-icon {
  display: inline-block;
  transform-origin: center;
}

.refresh-icon.spinning {
  animation: spin-refresh 0.9s linear infinite;
}

@keyframes spin-refresh {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.remote-detail {
  font-size: 13px;
}

.detail-row {
  display: flex;
  margin-bottom: 8px;
}

.detail-row .label {
  color: #888;
  width: 60px;
}

.detail-row .value {
  flex: 1;
  word-break: break-all;
}

.detail-row .value.url {
  font-size: 12px;
  color: #6a9955;
}

.sync-status {
  display: flex;
  gap: 20px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #3c3c3c;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.status-item .count {
  font-size: 20px;
  font-weight: 600;
}

.status-item.ahead .count {
  color: #4ec9b0;
}

.status-item.behind .count {
  color: #dcdcaa;
}

.status-item .label {
  font-size: 12px;
  color: #888;
}

.unpushed-files {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #3c3c3c;
}

.unpushed-title {
  font-size: 12px;
  color: #969696;
  margin-bottom: 6px;
}

.unpushed-files ul {
  margin: 0;
  padding-left: 18px;
  max-height: 140px;
  overflow: auto;
}

.unpushed-files li {
  font-size: 12px;
  line-height: 1.5;
  color: #d4d4d4;
  word-break: break-all;
}

.unpushed-note {
  margin-top: 10px;
  font-size: 12px;
  color: #888;
}

.no-remote {
  text-align: center;
  padding: 20px;
  color: #888;
}

.no-remote p {
  margin-bottom: 12px;
}

/* Add Remote Form */
.add-remote-form {
  background: #252526;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.add-remote-form h3 {
  font-size: 14px;
  margin-bottom: 12px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #969696;
}

.form-group input {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: #d4d4d4;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #0e639c;
}

.form-actions {
  display: flex;
  gap: 8px;
}

.form-actions button {
  background: #3c3c3c;
  color: #d4d4d4;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

/* Sync Actions */
.sync-actions {
  background: #252526;
  padding: 16px;
  border-radius: 8px;
}

.sync-actions h3 {
  font-size: 14px;
  color: #969696;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-group {
  flex: 1;
  min-width: 120px;
}

.action-group button {
  width: 100%;
  padding: 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.action-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-fetch {
  background: #3c3c3c;
  color: #d4d4d4;
  border: none;
}

.btn-fetch:hover:not(:disabled) {
  background: #4c4c4c;
}

.btn-pull {
  background: #0e639c;
  color: white;
  border: none;
}

.btn-pull:hover:not(:disabled) {
  background: #1177bb;
}

.btn-push {
  background: #238636;
  color: white;
  border: none;
}

.btn-push:hover:not(:disabled) {
  background: #2ea043;
}

.hint {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
  text-align: center;
}

/* Progress */
.progress-bar {
  height: 24px;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0e639c, #4ec9b0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  transition: width 0.3s ease;
}

/* Result */
.sync-result {
  margin-top: 16px;
  padding: 16px;
  border-radius: 6px;
  font-size: 14px;
}

.sync-result.success {
  background: rgba(35, 134, 54, 0.2);
  color: #4ec9b0;
}

.sync-result.error {
  background: rgba(218, 54, 51, 0.2);
  color: #f85149;
}

.error-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.error-message {
  font-size: 13px;
}

.error-hint {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-size: 13px;
}

.error-hint ol {
  margin: 8px 0 0 20px;
}

.error-hint li {
  margin-bottom: 4px;
}

.output {
  margin-top: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  color: #888;
}
</style>