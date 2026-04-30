<template>
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">{{ title }}</h2>
      <div v-if="currentRepo" class="toolbar">
        <button
          @click="refresh"
          class="btn-refresh"
          :disabled="isLoadingAny"
          :title="t('branches.toolbar.refreshTitle')"
        >
          {{ opType === 'refresh' ? t('branches.toolbar.refreshing') : t('branches.toolbar.refresh') }}
        </button>
      </div>
    </div>

    <p v-if="!currentRepo" class="no-repo">
      {{ t('changes.noRepo') }}
    </p>

    <template v-else>
      <div class="branches-layout">
        <div class="branch-lists">
          <div class="list-card">
            <h3>
              {{ t('branches.local.title') }}
              <span class="h3-tooltip" :data-tooltip="t('branches.local.tip')">?</span>
            </h3>

            <div class="list">
              <div v-if="!localBranches.length" class="empty">
                {{ t('branches.emptyLocal') }}
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
                  :data-tooltip="switchBranchTooltip(b)"
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
                  :title="t('branches.deleteLocalTitle')"
                  :disabled="localDeleteDisabled(b)"
                >
                  {{ opType === 'deleteLocal' && opTarget === b ? '⏳' : '✕' }}
                </button>
              </div>
            </div>

            <div class="form-card">
              <h4>{{ t('branches.new.title') }}</h4>

              <div class="form-row">
                <label>{{ t('branches.new.name') }}</label>
                <input v-model="newBranchName" placeholder="feature/xxx" />
              </div>

              <div class="form-row">
                <label>{{ t('branches.new.base') }}</label>
                <select v-model="newBranchBase">
                  <option value="">
                    {{ currentBranch ? t('branches.new.baseCurrentNamed', { branch: currentBranch }) : t('branches.new.baseCurrent') }}
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
                  {{ opType === 'create' ? t('branches.new.creating') : t('branches.new.create') }}
                </button>
                <span class="tooltip-wrapper">
                  <span class="tooltip-icon" :title="t('branches.new.hintIconTitle')">
                    ?
                  </span>
                  <span class="tooltip-text">
                    {{ t('branches.new.hint') }}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div class="list-card">
            <h3>
              {{ t('branches.remote.title') }}
              <span class="h3-tooltip" :data-tooltip="t('branches.remote.tip')">?</span>
            </h3>

            <div class="list">
              <div v-if="remoteError" class="empty remote-error">
                {{ t('branches.remote.readFailed', { msg: remoteError }) }}
              </div>
              <div v-if="!hasRemote" class="empty">{{ t('branches.remote.noRemote') }}</div>
              <div v-else-if="!remoteBranches.length" class="empty">{{ t('branches.remote.empty') }}</div>

              <div v-for="b in remoteBranches" :key="b" class="branch-item remote-item">
                <span class="branch-name-text">{{ b }}</span>
                <button
                  class="btn-icon danger"
                  @click.stop="promptDeleteRemote(b)"
                  :title="t('branches.deleteRemoteTitle')"
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
              {{ t('branches.merge.title') }}
              <span class="h3-tooltip" :data-tooltip="t('branches.merge.tip')">?</span>
            </h3>

            <div class="form-row">
              <label>{{ t('branches.merge.target') }}</label>
              <select v-model="mergeTarget" :disabled="localBranches.length === 0 || opBusy">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-row">
              <label>{{ t('branches.merge.source') }}</label>
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
                {{ opType === 'merge' ? t('branches.merge.merging') : t('branches.merge.btn') }}
              </button>
            </div>

            <p v-if="opResult?.merge" class="op-result" :class="{ success: opResult.merge.success, error: !opResult.merge.success }">
              {{ opResult.merge.success ? t('branches.merge.ok') : t('branches.merge.fail', { msg: opResult.merge.error || '' }) }}
            </p>
          </div>

          <div class="op-card">
            <h3>
              {{ t('branches.rebase.title') }}
              <span class="h3-tooltip" :data-tooltip="t('branches.rebase.tip')">?</span>
            </h3>

            <div class="form-row">
              <label>{{ t('branches.rebase.branch') }}</label>
              <select v-model="rebaseBranch" :disabled="localBranches.length === 0 || opBusy">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-row">
              <label>{{ t('branches.rebase.onto') }}</label>
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
                {{ opType === 'rebase' ? t('branches.rebase.rebasing') : t('branches.rebase.btn') }}
              </button>
            </div>

            <p v-if="opResult?.rebase" class="op-result" :class="{ success: opResult.rebase.success, error: !opResult.rebase.success }">
              {{ opResult.rebase.success ? t('branches.rebase.ok') : t('branches.rebase.fail', { msg: opResult.rebase.error || '' }) }}
            </p>
          </div>

          <div class="diff-card">
            <h3>
              {{ t('branches.diff.title') }}
              <span class="h3-tooltip" :data-tooltip="t('branches.diff.tip')">?</span>
            </h3>

            <div class="form-row">
              <label>{{ t('branches.diff.base') }}</label>
              <select v-model="diffFrom" :disabled="localBranches.length === 0 || isDiffLoading">
                <option v-for="b in localBranches" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="form-row">
              <label>{{ t('branches.diff.compare') }}</label>
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
                {{ isDiffLoading ? t('branches.diff.comparing') : t('branches.diff.btn') }}
              </button>
            </div>

            <div v-if="isDiffLoading" class="diff-loading">{{ t('branches.diff.loading') }}</div>
            <pre v-else class="diff-output">{{ diffOutput || t('branches.diff.placeholder') }}</pre>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
const diffOutput = ref('')
const isDiffLoading = ref(false)

const opBusy = ref(false)
const opType = ref('')
const opTarget = ref('')
const opResult = ref({ merge: null, rebase: null })

const remoteError = ref('')

const isLoadingAny = computed(() => opBusy.value || isDiffLoading.value)

function switchBranchTooltip(b) {
  return b === currentBranch.value
    ? t('branches.tooltipOnBranch')
    : t('branches.tooltipSwitchTo', { branch: b })
}

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
        remoteError.value = String(remoteErr?.message || remoteErr || t('branches.remote.fetchFailed'))
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
      alert(t('branches.alerts.switchFailed', { msg: res?.error || '' }))
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
      alert(t('branches.alerts.createFailed', { msg: res?.error || '' }))
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
    alert(t('branches.alerts.cannotDeleteCurrent'))
    return
  }

  if (!confirm(t('branches.alerts.deleteLocalConfirm', { name: branchName }))) return

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

    if (suggestsForce && confirm(t('branches.alerts.forceDeleteConfirm'))) {
      res = await window.electronAPI.deleteBranch(props.currentRepo.path, branchName, true)
      if (!res?.success) {
        alert(t('branches.alerts.forceDeleteFailed', { msg: res?.error || '' }))
        return
      }
      await loadAll()
      return
    }

    alert(t('branches.alerts.deleteFailed', { msg }))
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

  if (!confirm(t('branches.alerts.deleteRemoteConfirm', { name: remoteBranch }))) return

  startOp('deleteRemote', remoteBranch)
  try {
    const { remoteName, branchName } = parseRemoteBranch(remoteBranch)
    const res = await window.electronAPI.deleteRemoteBranch(props.currentRepo.path, remoteName, branchName)
    if (!res?.success) {
      alert(t('branches.alerts.deleteRemoteFailed', { msg: res?.error || '' }))
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
    const ok = confirm(t('branches.alerts.mergeConfirm', { source: mergeSource.value, target: mergeTarget.value }))
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
    const ok = confirm(t('branches.alerts.rebaseConfirm', { branch: rebaseBranch.value, onto: rebaseOnto.value }))
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
    diffOutput.value = out && out.trim().length > 0 ? out : t('branches.diff.noDiff')
  } catch (e) {
    diffOutput.value = t('branches.diff.fail', { msg: e?.message || String(e || '') })
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

