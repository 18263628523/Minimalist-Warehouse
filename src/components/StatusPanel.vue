<template>
  <div class="panel">
    <h2>{{ title }}</h2>

    <p v-if="!currentRepo" class="no-repo">
      请先在「仓库管理」中打开一个 Git 仓库
    </p>

    <template v-else>
      <!-- Toolbar -->
      <div class="toolbar">
        <button @click="refreshStatus" class="btn-refresh" title="刷新">
          🔄 刷新
        </button>
        <button @click="selectAll" class="btn-select" title="全选">
          {{ allSelected ? '☑ 全选' : '☐ 全选' }}
        </button>
        <div class="toolbar-actions" v-if="hasChanges">
          <button @click="stageSelected" class="btn-primary" title="添加到暂存">
            + 暂存
          </button>
          <button @click="unstageSelected" title="取消暂存">
            - 暂存
          </button>
          <button @click="discardSelected" class="btn-danger" title="撤销更改">
            ↩ 撤销
          </button>
          <button @click="ignoreSelected" title="添加到 .gitignore">
            ⊘ 忽略
          </button>
        </div>
      </div>

      <!-- File Lists -->
      <div class="file-sections">
        <!-- Staged Files -->
        <div class="file-section" v-if="status.staged.length > 0">
          <h3 class="section-title staged">
            ▶ 已暂存 ({{ status.staged.length }})
          </h3>
          <div class="file-list">
            <label 
              v-for="file in status.staged" 
              :key="file.path" 
              class="file-item staged"
            >
              <input 
                type="checkbox" 
                :checked="selectedFiles.includes(file.path)"
                @change="toggleSelect(file.path)"
              />
              <span class="file-path">{{ file.path }}</span>
              <span class="file-status">[{{ file.status }}]</span>
              <button class="btn-icon" @click="viewDiff(file.path, 'staged')" title="查看差异">
                📄
              </button>
            </label>
          </div>
        </div>

        <!-- Modified Files -->
        <div class="file-section" v-if="status.modified.length > 0">
          <h3 class="section-title modified">
            ▼ 已修改 ({{ status.modified.length }})
          </h3>
          <div class="file-list">
            <label 
              v-for="file in status.modified" 
              :key="file.path" 
              class="file-item modified"
            >
              <input 
                type="checkbox" 
                :checked="selectedFiles.includes(file.path)"
                @change="toggleSelect(file.path)"
              />
              <span class="file-path">{{ file.path }}</span>
              <button class="btn-icon" @click="viewDiff(file.path)" title="查看差异">
                📄
              </button>
            </label>
          </div>
        </div>

        <!-- Untracked Files -->
        <div class="file-section" v-if="status.untracked.length > 0">
          <h3 class="section-title untracked">
            ✗ 未跟踪 ({{ status.untracked.length }})
          </h3>
          <div class="file-list">
            <label 
              v-for="file in status.untracked" 
              :key="file.path" 
              class="file-item untracked"
            >
              <input 
                type="checkbox" 
                :checked="selectedFiles.includes(file.path)"
                @change="toggleSelect(file.path)"
              />
              <span class="file-path">{{ file.path }}</span>
              <button class="btn-icon" @click="ignoreSingle(file.path)" title="添加到 .gitignore">
                ⊘
              </button>
            </label>
          </div>
        </div>

        <!-- Deleted Files -->
        <div class="file-section" v-if="status.deleted.length > 0">
          <h3 class="section-title deleted">
            ✖ 已删除 ({{ status.deleted.length }})
          </h3>
          <div class="file-list">
            <label 
              v-for="file in status.deleted" 
              :key="file.path" 
              class="file-item deleted"
            >
              <input 
                type="checkbox" 
                :checked="selectedFiles.includes(file.path)"
                @change="toggleSelect(file.path)"
              />
              <span class="file-path">{{ file.path }}</span>
              <button class="btn-icon" @click="viewDiff(file.path)" title="查看差异">
                📄
              </button>
            </label>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" v-if="!hasChanges">
          <p>✓ 工作区干净，没有变更</p>
        </div>
      </div>

      <!-- Diff Modal -->
      <div v-if="showDiff" class="modal" @click.self="showDiff = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ diffTitle }}</h3>
            <button class="btn-close" @click="showDiff = false">✕</button>
          </div>
          <pre class="diff-content">{{ diffContent }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  readyText: { type: String, default: '' },
  currentRepo: { type: Object, default: null },
  mode: { type: String, default: 'text' }
})

const emit = defineEmits(['change'])

const status = ref({
  modified: [],
  staged: [],
  untracked: [],
  deleted: []
})

const selectedFiles = ref([])
const showDiff = ref(false)
const diffContent = ref('')
const diffTitle = ref('')

const hasChanges = computed(() => {
  return status.value.modified.length > 0 || 
         status.value.staged.length > 0 || 
         status.value.untracked.length > 0 ||
         status.value.deleted.length > 0
})

const allSelected = computed(() => {
  const allFiles = [
    ...status.value.modified,
    ...status.value.staged,
    ...status.value.untracked,
    ...status.value.deleted
  ]
  return allFiles.length > 0 && selectedFiles.value.length === allFiles.length
})

// Load status
async function loadStatus() {
  if (!props.currentRepo || !window.electronAPI) return
  
  const result = await window.electronAPI.getStatus(props.currentRepo.path)
  status.value = result
  selectedFiles.value = []
}

// Refresh status
function refreshStatus() {
  loadStatus()
}

// Toggle file selection
function toggleSelect(filePath) {
  const index = selectedFiles.value.indexOf(filePath)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  } else {
    selectedFiles.value.push(filePath)
  }
}

// Select all
function selectAll() {
  if (allSelected.value) {
    selectedFiles.value = []
  } else {
    const allFiles = [
      ...status.value.modified,
      ...status.value.staged,
      ...status.value.untracked,
      ...status.value.deleted
    ]
    selectedFiles.value = allFiles.map(f => f.path)
  }
}

// Stage selected files
async function stageSelected() {
  if (!window.electronAPI || selectedFiles.value.length === 0) return
  
  const filesToStage = [
    ...status.value.modified,
    ...status.value.untracked,
    ...status.value.deleted
  ].filter(f => selectedFiles.value.includes(f.path)).map(f => f.path)
  
  const result = await window.electronAPI.add(props.currentRepo.path, filesToStage)
  
  if (result.success) {
    await loadStatus()
  } else {
    alert('暂存失败: ' + result.error)
  }
}

// Unstage selected files
async function unstageSelected() {
  if (!window.electronAPI || selectedFiles.value.length === 0) return
  
  const result = await window.electronAPI.reset(props.currentRepo.path, selectedFiles.value)
  
  if (result.success) {
    await loadStatus()
  } else {
    alert('取消暂存失败: ' + result.error)
  }
}

// Discard selected changes
async function discardSelected() {
  if (!window.electronAPI || selectedFiles.value.length === 0) return
  
  if (!confirm('确定要撤销这些文件的更改吗？此操作不可恢复！')) return
  
  const result = await window.electronAPI.checkout(props.currentRepo.path, selectedFiles.value)
  
  if (result.success) {
    await loadStatus()
  } else {
    alert('撤销失败: ' + result.error)
  }
}

// Ignore selected files
async function ignoreSelected() {
  if (!window.electronAPI || selectedFiles.value.length === 0) return
  
  for (const file of selectedFiles.value) {
    await window.electronAPI.addToIgnore(props.currentRepo.path, file)
  }
  
  await loadStatus()
}

// Ignore single file
async function ignoreSingle(filePath) {
  if (!window.electronAPI) return
  
  await window.electronAPI.addToIgnore(props.currentRepo.path, filePath)
  await loadStatus()
}

// View diff
async function viewDiff(filePath, staged = null) {
  if (!window.electronAPI) return
  
  if (staged) {
    diffContent.value = await window.electronAPI.diffCached(props.currentRepo.path, filePath)
    diffTitle.value = filePath + ' (已暂存)'
  } else {
    diffContent.value = await window.electronAPI.diff(props.currentRepo.path, filePath)
    diffTitle.value = filePath + ' (未暂存)'
  }
  
  if (!diffContent.value) {
    diffContent.value = '(没有差异)'
  }
  
  showDiff.value = true
}

// Watch for repo changes
watch(() => props.currentRepo, () => {
  if (props.currentRepo) {
    loadStatus()
  }
}, { immediate: true })
</script>

<style scoped>
.panel {
  height: 100%;
}

.panel h2 {
  font-size: 18px;
  margin-bottom: 16px;
}

.no-repo {
  color: #888;
  font-style: italic;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #252526;
  border-radius: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.toolbar button {
  background: #3c3c3c;
  color: #d4d4d4;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.toolbar button:hover {
  background: #4c4c4c;
}

.btn-refresh {
  background: #0e639c !important;
}

.btn-primary {
  background: #238636 !important;
  color: white !important;
}

.btn-primary:hover {
  background: #2ea043 !important;
}

.btn-danger {
  background: #da3633 !important;
}

.btn-danger:hover {
  background: #f85149 !important;
}

.btn-select {
  background: #3c3c3c !important;
}

/* File Sections */
.file-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-section {
  background: #252526;
  border-radius: 6px;
  overflow: hidden;
}

.section-title {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  background: #2d2d2d;
  border-bottom: 1px solid #3c3c3c;
}

.section-title.staged {
  color: #4ec9b0;
}

.section-title.modified {
  color: #dcdcaa;
}

.section-title.untracked {
  color: #888;
}

.section-title.deleted {
  color: #f14c4c;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  gap: 10px;
  cursor: pointer;
  border-bottom: 1px solid #333;
}

.file-item:hover {
  background: #2a2d2e;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item input[type="checkbox"] {
  cursor: pointer;
}

.file-path {
  flex: 1;
  font-size: 13px;
  word-break: break-all;
}

.file-status {
  font-size: 12px;
  color: #888;
}

.btn-icon {
  background: transparent !important;
  padding: 4px 8px !important;
  font-size: 12px;
}

.btn-icon:hover {
  background: #3c3c3c !important;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 40px;
  color: #4ec9b0;
  background: #252526;
  border-radius: 6px;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #252526;
  border-radius: 8px;
  width: 80%;
  max-height: 80%;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #3c3c3c;
}

.modal-header h3 {
  font-size: 16px;
}

.btn-close {
  background: transparent !important;
  font-size: 18px;
  padding: 4px 8px !important;
}

.diff-content {
  padding: 16px;
  overflow: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  color: #d4d4d4;
}
</style>