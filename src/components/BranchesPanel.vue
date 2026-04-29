<template>
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">{{ title }}</h2>
      <div v-if="currentRepo" class="toolbar">
        <button
          @click="refresh"
          class="btn-refresh"
          :disabled="isLoadingAny"
          title="刷新"
        >
          {{ opType === 'refresh' ? '🔄 刷新中...' : '🔄 刷新' }}
        </button>
      </div>
    </div>

    <p v-if="!currentRepo" class="no-repo">
      请先在「仓库管理」中打开一个 Git 仓库
    </p>

    <template v-else>
      <div class="branches-layout">
        <div class="branch-lists">
          <div class="list-card">
            <h3>
              本地分支
              <span class="h3-tooltip" data-tooltip="展示所有本地分支；点击即可切换到该分支。">?</span>
            </h3>

            <div class="list">
              <div v-if="!localBranches.length" class="empty">
                暂无本地分支
              </div>

              <div
                v-for="b in localBranches"
                :key="b"
                :class="['branch-item', { active: b === currentBranch }]"
              >
                <button
                  class="branch-name-btn"
                  @click="onSwitch(b)"
                  :disabled="b === currentBranch || isLoadingAny"
                  :data-tooltip="b === currentBranch ? '已在当前分支' : `切换到本地分支「${b}」`"
                >
                  <template v-if="opType === 'switch' && opTarget === b">
                    <span class="inline-loading">⏳</span>{{ b }}
                  </template>
                  <template v-else>
                    {{ b }}
                  </template>
                </button>
                <button
                  class="btn-icon danger"
                  @click.stop="promptDeleteLocal(b)"
                  title="删除本地分支"
                  :disabled="localDeleteDisabled(b)"
                >
                  {{ opType === 'deleteLocal' && opTarget === b ? '⏳' : '✕' }}
                </button>
              </div>
            </div>

            <div class="form-card">
              <h4>新建分支</h4>

              <div class="form-row">
                <label>名称</label>
                <input v-model="newBranchName" placeholder="feature/xxx" />
              </div>

              <div class="form-row">
                <label>基于</label>
                <select v-model="newBranchBase">
                  <option value="">
                    {{ currentBranch ? `当前分支 (${currentBranch})` : '当前分支' }}
                  </option>
                  <option v-for="b in localBranches" :key="b" :value="b">
                    {{ b }}
                  </option>
                </select>
              </div>

              <div class="form-actions">
                <button
                  class="btn-primary"
                  :disabled="!canCreateBranch || isLoadingAny"
                  @click="createNewBranch"
                >
                  {{ opType === 'create' ? '⏳ 创建中...' : '创建' }}
                </button>
                <span class="tooltip-wrapper">
                  <span class="tooltip-icon" title="Tooltip">
                    ?
                  </span>
                  <span class="tooltip-text">
                    新建的是「本地分支」。想在 GitHub 上看到，需要切到该分支后执行推送（Push）并刷新远程分支列表。
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div class="list-card">
            <h3>
              远程分支
              <span class="h3-tooltip" data-tooltip="展示远程仓库分支（如 origin/main）。新建分支只会先创建本地，需要 Push 才会出现在远程。">?</span>
            </h3>

            <div class="list">
              <div v-if="remoteError" class="empty remote-error">
                远程分支读取失败：{{ remoteError }}
              </div>
              <div v-if="!hasRemote" class="empty">未关联远程仓库</div>
              <div v-else-if="!remoteBranches.length" class="empty">暂无远程分支</div>

              <div v-for="b in remoteBranches" :key="b" class="branch-item remote-item">
                <span class="branch-name-text">{{ b }}</span>
                <button
                  class="btn-icon danger"
                  @click.stop="promptDeleteRemote(b)"
                  title="删除远程分支"
                  :disabled="isLoadingAny"
                >
                  {{ opType === 'deleteRemote' && opTarget === b ? '⏳' : '✕' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="op-panel">
          <div class="op-card">
            <h3>
              合并分支
              <span class="h3-tooltip" data-tooltip="将来源分支合并到目标分支：git switch 目标 + git merge 来源。">?</span>
            </h3>

            <div class="form-row">
              <label>目标分支</label>
              <select v-model="mergeTarget" :disabled="localBranches.length === 0 || opBusy">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-row">
              <label>来源分支</label>
              <select v-model="mergeSource" :disabled="localBranches.length === 0 || opBusy">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-actions">
              <button
                class="btn-primary"
                :disabled="!canMerge || isLoadingAny"
                @click="doMerge"
              >
                {{ opType === 'merge' ? '⏳ 合并中...' : '合并' }}
              </button>
            </div>

            <p v-if="opResult?.merge" class="op-result" :class="{ success: opResult.merge.success, error: !opResult.merge.success }">
              {{ opResult.merge.success ? '✓ 合并完成' : '✕ 合并失败: ' + (opResult.merge.error || '') }}
            </p>
          </div>

          <div class="op-card">
            <h3>
              变基
              <span class="h3-tooltip" data-tooltip="将选定分支 rebase 到另一个分支上：git switch 分支 + git rebase onto。">?</span>
            </h3>

            <div class="form-row">
              <label>要变基</label>
              <select v-model="rebaseBranch" :disabled="localBranches.length === 0 || opBusy">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-row">
              <label>onto</label>
              <select v-model="rebaseOnto" :disabled="localBranches.length === 0 || opBusy">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-actions">
              <button
                class="btn-primary"
                :disabled="!canRebase || isLoadingAny"
                @click="doRebase"
              >
                {{ opType === 'rebase' ? '⏳ 变基中...' : '变基' }}
              </button>
            </div>

            <p v-if="opResult?.rebase" class="op-result" :class="{ success: opResult.rebase.success, error: !opResult.rebase.success }">
              {{ opResult.rebase.success ? '✓ 变基完成' : '✕ 变基失败: ' + (opResult.rebase.error || '') }}
            </p>
          </div>

          <div class="diff-card">
            <h3>
              对比分支差异
              <span class="h3-tooltip" data-tooltip="比较两个分支的差异内容：git diff base...compare。">?</span>
            </h3>

            <div class="form-row">
              <label>对比基准</label>
              <select v-model="diffFrom" :disabled="localBranches.length === 0 || isDiffLoading">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-row">
              <label>对比分支</label>
              <select v-model="diffTo" :disabled="localBranches.length === 0 || isDiffLoading">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-actions">
              <button
                class="btn-primary"
                :disabled="!canDiff || isLoadingAny"
                @click="doDiff"
              >
                {{ isDiffLoading ? '⏳ 对比中...' : '对比差异' }}
              </button>
            </div>

            <div v-if="isDiffLoading" class="diff-loading">加载 diff 中…</div>
            <pre v-else class="diff-output">{{ diffOutput }}</pre>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, default: '分支管理' },
  currentRepo: { type: Object, default: null },
  hasRemote: { type: Boolean, default: false }
})

const localBranches = ref([])
const remoteBranches = ref([])
const currentBranch = ref('')

const newBranchName = ref('')
const newBranchBase = ref('')

const mergeTarget = ref('')
const mergeSource = ref('')

const rebaseBranch = ref('')
const rebaseOnto = ref('')

const diffFrom = ref('')
const diffTo = ref('')
const diffOutput = ref('点击「对比差异」显示内容。')
const isDiffLoading = ref(false)

const opBusy = ref(false)
const opType = ref('')
const opTarget = ref('')
const opResult = ref({ merge: null, rebase: null })

const remoteError = ref('')

const isLoadingAny = computed(() => opBusy.value || isDiffLoading.value)

function startOp(type, target = '') {
  opBusy.value = true
  opType.value = type
  opTarget.value = target
}

function endOp() {
  opBusy.value = false
  opType.value = ''
  opTarget.value = ''
}

function pickDifferent(exclude, list) {
  return list.find(b => b !== exclude) || ''
}

function localDeleteDisabled(branchName) {
  // Avoid confusing UX: deleting current branch is not handled here.
  return opBusy.value || branchName === currentBranch.value || !branchName
}

const canCreateBranch = computed(() => {
  const name = (newBranchName.value || '').trim()
  if (!name) return false
  // Prevent trivial duplicates in UI; git would fail anyway.
  if (localBranches.value.includes(name)) return false
  return true
})

const canMerge = computed(() => {
  if (opBusy.value) return false
  if (!mergeTarget.value || !mergeSource.value) return false
  return mergeTarget.value !== mergeSource.value
})

const canRebase = computed(() => {
  if (opBusy.value) return false
  if (!rebaseBranch.value || !rebaseOnto.value) return false
  return rebaseBranch.value !== rebaseOnto.value
})

const canDiff = computed(() => {
  if (opBusy.value) return false
  if (!diffFrom.value || !diffTo.value) return false
  return diffFrom.value !== diffTo.value
})

async function loadAll() {
  if (!props.currentRepo || !window.electronAPI) return
  const repoPath = props.currentRepo.path

  remoteError.value = ''

  // 本地/远程分开加载：只要本地成功，界面就应该展示本地分支。
  try {
    const [cur, locals] = await Promise.all([
      window.electronAPI.currentBranch(repoPath),
      window.electronAPI.branches(repoPath)
    ])

    localBranches.value = locals || []
    currentBranch.value = cur || ''

    if (!currentBranch.value && localBranches.value.length > 0) {
      currentBranch.value = localBranches.value[0]
    }

    // 远程分支不影响本地展示
    if (props.hasRemote) {
      try {
        const remotes = await window.electronAPI.remoteBranches(repoPath)
        remoteBranches.value = remotes || []
      } catch (remoteErr) {
        remoteBranches.value = []
        remoteError.value = String(remoteErr?.message || remoteErr || '远程分支读取失败')
      }
    } else {
      remoteBranches.value = []
    }

    const curBranch = currentBranch.value
    if (!curBranch) return
    if (!localBranches.value.length) return

    // Defaults for forms
    if (!newBranchBase.value || !localBranches.value.includes(newBranchBase.value)) {
      newBranchBase.value = ''
    }

    mergeTarget.value = curBranch
    mergeSource.value = pickDifferent(mergeTarget.value, localBranches.value)

    rebaseBranch.value = curBranch
    rebaseOnto.value = pickDifferent(rebaseBranch.value, localBranches.value)

    diffFrom.value = curBranch
    diffTo.value = pickDifferent(diffFrom.value, localBranches.value)
  } catch (e) {
    // 本地分支失败时才清空本地列表
    localBranches.value = []
    remoteBranches.value = []
    currentBranch.value = ''
  }
}

async function refresh() {
  if (isLoadingAny.value) return
  startOp('refresh')
  try {
    await loadAll()
  } finally {
    endOp()
  }
}

async function onSwitch(branchName) {
  if (!props.currentRepo || !window.electronAPI) return
  if (!branchName || isLoadingAny.value) return

  startOp('switch', branchName)
  try {
    const res = await window.electronAPI.switchBranch(props.currentRepo.path, branchName)
    if (!res?.success) {
      alert('切换失败: ' + (res?.error || ''))
      return
    }
  } finally {
    await loadAll()
    endOp()
  }
}

async function createNewBranch() {
  if (!props.currentRepo || !window.electronAPI) return
  if (!canCreateBranch.value) return

  startOp('create')
  opResult.value.merge = null
  opResult.value.rebase = null

  try {
    const baseBranch = newBranchBase.value ? newBranchBase.value : null
    const name = newBranchName.value.trim()
    const res = await window.electronAPI.createBranch(props.currentRepo.path, name, baseBranch)
    if (!res?.success) {
      alert('创建失败: ' + (res?.error || ''))
      return
    }
    newBranchName.value = ''
    newBranchBase.value = ''
    await loadAll()
  } finally {
    endOp()
  }
}

async function promptDeleteLocal(branchName) {
  if (!props.currentRepo || !window.electronAPI) return
  if (!branchName) return
  if (branchName === currentBranch.value) {
    alert('无法删除当前正在使用的分支。请先切换到其它分支。')
    return
  }

  if (!confirm(`确定删除本地分支「${branchName}」吗？`)) return

  startOp('deleteLocal', branchName)
  opResult.value.merge = null
  opResult.value.rebase = null

  try {
    let res = await window.electronAPI.deleteBranch(props.currentRepo.path, branchName, false)
    if (res?.success) {
      await loadAll()
      return
    }

    const msg = String(res?.error || '')
    const lower = msg.toLowerCase()

    const suggestsForce =
      lower.includes('not fully merged') ||
      lower.includes('not fully merged') ||
      lower.includes('will not be deleted') ||
      lower.includes('cannot delete branch')

    if (suggestsForce && confirm('删除失败，可能未完成合并。是否强制删除？')) {
      res = await window.electronAPI.deleteBranch(props.currentRepo.path, branchName, true)
      if (!res?.success) {
        alert('强制删除失败: ' + (res?.error || ''))
        return
      }
      await loadAll()
      return
    }

    alert('删除失败: ' + msg)
  } finally {
    endOp()
  }
}

function parseRemoteBranch(remoteBranch) {
  const parts = (remoteBranch || '').split('/')
  const remoteName = parts.shift() || 'origin'
  const branchName = parts.join('/')
  return { remoteName, branchName }
}

async function promptDeleteRemote(remoteBranch) {
  if (!props.currentRepo || !window.electronAPI) return
  if (!remoteBranch) return
  if (!props.hasRemote) return

  if (!confirm(`确定删除远程分支「${remoteBranch}」吗？`)) return

  startOp('deleteRemote', remoteBranch)
  try {
    const { remoteName, branchName } = parseRemoteBranch(remoteBranch)
    const res = await window.electronAPI.deleteRemoteBranch(props.currentRepo.path, remoteName, branchName)
    if (!res?.success) {
      alert('删除远程分支失败: ' + (res?.error || ''))
      return
    }
    await loadAll()
  } finally {
    endOp()
  }
}

async function doMerge() {
  if (!props.currentRepo || !window.electronAPI) return
  if (!canMerge.value) return

  startOp('merge')
  opResult.value.merge = null

  try {
    const ok = confirm(`将「${mergeSource.value}」合并到「${mergeTarget.value}」？`)
    if (!ok) return

    const res = await window.electronAPI.mergeBranches(props.currentRepo.path, mergeTarget.value, mergeSource.value)
    opResult.value.merge = res
    await loadAll()
  } finally {
    endOp()
  }
}

async function doRebase() {
  if (!props.currentRepo || !window.electronAPI) return
  if (!canRebase.value) return

  startOp('rebase')
  opResult.value.rebase = null

  try {
    const ok = confirm(`将「${rebaseBranch.value}」变基到「${rebaseOnto.value}」？`)
    if (!ok) return

    const res = await window.electronAPI.rebaseBranches(props.currentRepo.path, rebaseBranch.value, rebaseOnto.value)
    opResult.value.rebase = res
    await loadAll()
  } finally {
    endOp()
  }
}

async function doDiff() {
  if (!props.currentRepo || !window.electronAPI) return
  if (!canDiff.value) return

  startOp('diff')
  isDiffLoading.value = true
  diffOutput.value = ''

  try {
    const out = await window.electronAPI.diffBranches(props.currentRepo.path, diffFrom.value, diffTo.value)
    diffOutput.value = out && out.trim().length > 0 ? out : '无差异（或无法生成差异输出）。'
  } catch (e) {
    diffOutput.value = '对比失败: ' + (e?.message || String(e || ''))
  } finally {
    isDiffLoading.value = false
    endOp()
  }
}

onMounted(() => {
  loadAll()
})

watch(
  () => props.currentRepo,
  () => {
    if (props.currentRepo) loadAll()
  },
  { immediate: false }
)
</script>

<style scoped>
.panel {
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}

.toolbar button {
  background: #3c3c3c;
  color: #d4d4d4;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-refresh {
  background: #0e639c !important;
}

.no-repo {
  color: #888;
  font-style: italic;
}

.branches-layout {
  height: calc(100% - 64px);
  min-height: 520px;
  display: grid;
  grid-template-columns: 560px 1fr;
  gap: 14px;
}

.branch-lists {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-content: start;
}

.list-card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  padding: 12px;
  min-width: 0;
}

.list-card h3 {
  font-size: 14px;
  color: #969696;
  margin: 0 0 10px;
  font-weight: 600;
}

.list {
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  overflow: auto;
  max-height: 280px;
}

.empty {
  padding: 14px;
  color: #888;
  font-size: 13px;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #2d2d2d;
}

.branch-item:last-child {
  border-bottom: none;
}

.branch-item.active {
  background: rgba(78, 201, 176, 0.08);
  outline: 1px solid rgba(78, 201, 176, 0.45);
}

.branch-name-btn {
  flex: 1;
  text-align: left;
  background: transparent;
  border: none;
  color: #d4d4d4;
  cursor: pointer;
  padding: 0;
  font-size: 13px;
  word-break: break-all;
  position: relative;
}

.branch-name-btn:disabled {
  cursor: default;
  opacity: 0.85;
}

.inline-loading {
  display: inline-flex;
  margin-right: 6px;
  color: #d4d4d4;
}

.branch-name-btn[data-tooltip]::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translate(-50%, 6px);
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  color: #d4d4d4;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  white-space: normal;
  max-width: 320px;
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.branch-name-btn[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 10px);
}

.branch-name-text {
  flex: 1;
  font-size: 13px;
  word-break: break-all;
  color: #d4d4d4;
}

.btn-icon {
  background: transparent !important;
  border: none;
  color: #d4d4d4;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.btn-icon:hover:not(:disabled) {
  background: #3c3c3c !important;
}

.btn-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-icon.danger {
  color: #f85149;
}

.remote-item .btn-icon.danger {
  margin-left: 6px;
}

.form-card {
  margin-top: 12px;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 10px;
}

.form-card h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: #969696;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.form-row label {
  color: #888;
  font-size: 12px;
  width: 48px;
}

.form-row input,
.form-row select {
  flex: 1;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: #d4d4d4;
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 13px;
}

.form-row input:focus,
.form-row select:focus {
  outline: none;
  border-color: #0e639c;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
}

.tooltip-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #3c3c3c;
  color: #d4d4d4;
  font-size: 12px;
  cursor: help;
  user-select: none;
}

.tooltip-text {
  position: absolute;
  left: 0;
  top: 28px;
  width: 320px;
  max-width: 70vw;
  padding: 10px 12px;
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  visibility: hidden;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 10;
}

.tooltip-wrapper:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}

.h3-tooltip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3c3c3c;
  color: #d4d4d4;
  font-size: 11px;
  margin-left: 8px;
  cursor: help;
  user-select: none;
  position: relative;
}

.h3-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 0;
  top: 22px;
  transform: translateY(-4px);
  width: 340px;
  max-width: 70vw;
  padding: 10px 12px;
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 20;
  pointer-events: none;
  white-space: normal;
}

.h3-tooltip:hover::after {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}

.btn-primary {
  background: #238636;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.op-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.op-card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  padding: 12px;
}

.op-card h3,
.diff-card h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #969696;
}

.op-result {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.op-result.success {
  background: rgba(35, 134, 54, 0.2);
  color: #4ec9b0;
}

.op-result.error {
  background: rgba(218, 54, 51, 0.2);
  color: #f85149;
}

.diff-card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: 280px;
}

.diff-loading {
  margin-top: 12px;
  color: #888;
  font-size: 13px;
}

.diff-output {
  margin-top: 12px;
  flex: 1;
  overflow: auto;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #d4d4d4;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .branches-layout {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
  }
  .branch-lists {
    grid-template-columns: 1fr;
  }
}
</style>

