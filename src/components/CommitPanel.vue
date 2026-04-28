<template>
  <div class="panel">
    <h2>{{ title }}</h2>

    <p v-if="!currentRepo" class="no-repo">
      请先在「仓库管理」中打开一个 Git 仓库
    </p>

    <template v-else>
      <!-- Commit Message Input -->
      <div class="commit-form">
        <div class="form-group">
          <label>提交信息</label>
          <textarea 
            v-model="commitMessage" 
            placeholder="输入提交信息..."
            rows="3"
          ></textarea>
        </div>

        <!-- Amend Option -->
        <div class="form-group amend-option">
          <label>
            <input type="checkbox" v-model="useAmend" />
            追加到上一次提交 (amend)
          </label>
          <span class="hint" v-if="useAmend && lastCommitMsg">
            上次提交: {{ lastCommitMsg }}
          </span>
        </div>

        <!-- Staged Files -->
        <div class="staged-files" v-if="stagedFiles.length > 0">
          <h3>待提交文件 ({{ stagedFiles.length }})</h3>
          <ul class="file-list">
            <li v-for="file in stagedFiles" :key="file.path">
              <span class="file-status">[{{ file.status }}]</span>
              <span class="file-path">{{ file.path }}</span>
            </li>
          </ul>
        </div>
        <div class="no-staged" v-else>
          <p>暂无待提交文件，请先在「变更」中添加到暂存</p>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button 
            @click="doCommit" 
            class="btn-primary"
            :disabled="!canCommit"
            title="提交到本地仓库"
          >
            ✓ 提交
          </button>
          <button 
            @click="doCommitAndPush" 
            class="btn-push"
            :disabled="!canCommit || !hasRemote"
            title="提交并推送到远程"
          >
            ↑ 提交并推送
          </button>
        </div>

        <!-- Commit Result -->
        <div v-if="commitResult" class="commit-result" :class="{ success: commitResult.success, error: !commitResult.success }">
          {{ commitResult.success ? '提交成功!' : '提交失败: ' + commitResult.error }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  currentRepo: { type: Object, default: null },
  stagedData: { type: Array, default: () => [] }
})

const emit = defineEmits(['committed'])

const commitMessage = ref('')
const useAmend = ref(false)
const lastCommitMsg = ref('')
const commitResult = ref(null)
const stagedFiles = ref([])

const hasRemote = computed(() => {
  // This would be passed from parent or fetched
  return true
})

const canCommit = computed(() => {
  return commitMessage.value.trim().length > 0 && stagedFiles.value.length > 0
})

// Load last commit message
async function loadLastCommit() {
  if (!props.currentRepo || !window.electronAPI) return
  
  lastCommitMsg.value = await window.electronAPI.lastCommitMsg(props.currentRepo.path)
}

// Load staged files from status
async function loadStaged() {
  if (!props.currentRepo || !window.electronAPI) return
  
  const status = await window.electronAPI.getStatus(props.currentRepo.path)
  stagedFiles.value = status.staged
}

// Do commit
async function doCommit() {
  if (!window.electronAPI || !canCommit.value) return
  
  commitResult.value = null
  
  let result
  if (useAmend.value) {
    result = await window.electronAPI.commitAmend(
      props.currentRepo.path, 
      commitMessage.value,
      false // allow edit
    )
  } else {
    result = await window.electronAPI.commit(
      props.currentRepo.path, 
      commitMessage.value
    )
  }
  
  commitResult.value = result
  
  if (result.success) {
    commitMessage.value = ''
    useAmend.value = false
    emit('committed')
    // Refresh after commit
    setTimeout(() => {
      loadStaged()
      loadLastCommit()
    }, 500)
  }
}

// Do commit and push
async function doCommitAndPush() {
  if (!window.electronAPI || !canCommit.value) return
  
  commitResult.value = null
  
  const result = await window.electronAPI.commitAndPush(
    props.currentRepo.path, 
    commitMessage.value
  )
  
  commitResult.value = result
  
  if (result.success) {
    commitMessage.value = ''
    useAmend.value = false
    emit('committed')
    setTimeout(() => {
      loadStaged()
      loadLastCommit()
    }, 500)
  }
}

// Watch for repo changes
watch(() => props.currentRepo, () => {
  if (props.currentRepo) {
    loadLastCommit()
    loadStaged()
  }
}, { immediate: true })

// Expose method to refresh staged files
defineExpose({
  refreshStaged: loadStaged
})
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

.commit-form {
  background: #252526;
  padding: 20px;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #969696;
}

.form-group textarea {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 14px;
}

.form-group textarea:focus {
  outline: none;
  border-color: #0e639c;
}

.amend-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.amend-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  cursor: pointer;
}

.amend-option .hint {
  font-size: 12px;
  color: #888;
  font-style: italic;
}

.staged-files {
  margin: 20px 0;
}

.staged-files h3 {
  font-size: 14px;
  color: #4ec9b0;
  margin-bottom: 12px;
}

.file-list {
  list-style: none;
  background: #1e1e1e;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.file-list li {
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  font-size: 13px;
}

.file-list li:last-child {
  border-bottom: none;
}

.file-status {
  color: #4ec9b0;
  margin-right: 8px;
}

.file-path {
  word-break: break-all;
}

.no-staged {
  text-align: center;
  padding: 20px;
  color: #888;
  background: #1e1e1e;
  border-radius: 4px;
}

.no-staged p {
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

button {
  background: #3c3c3c;
  color: #d4d4d4;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover:not(:disabled) {
  background: #4c4c4c;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #238636;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2ea043;
}

.btn-push {
  background: #0e639c;
  color: white;
}

.btn-push:hover:not(:disabled) {
  background: #1177bb;
}

.commit-result {
  margin-top: 16px;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
}

.commit-result.success {
  background: rgba(35, 134, 54, 0.2);
  color: #4ec9b0;
}

.commit-result.error {
  background: rgba(218, 54, 51, 0.2);
  color: #f85149;
}
</style>