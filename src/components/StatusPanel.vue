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

      <div class="changes-layout" v-if="mode === 'changes'">
        <!-- File Lists (Left) -->
        <div class="changes-left">
          <div class="file-sections">
            <!-- Staged Files -->
            <div class="file-section" v-if="status.staged.length > 0">
              <h3 class="section-title staged">
                ▶ 已暂存 ({{ status.staged.length }})
              </h3>
              <div class="file-list">
                <div
                  v-for="file in status.staged"
                  :key="file.path"
                  :class="['file-item', 'staged', { active: activeFile?.path === file.path }]"
                  @click="openDiff(file.path, true)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedFiles.includes(file.path)"
                    @click.stop
                    @change="toggleSelect(file.path)"
                  />
                  <span class="file-path">{{ file.path }}</span>
                  <span class="file-status">[{{ file.status }}]</span>
                </div>
              </div>
            </div>

            <!-- Modified Files -->
            <div class="file-section" v-if="status.modified.length > 0">
              <h3 class="section-title modified">
                ▼ 已修改 ({{ status.modified.length }})
              </h3>
              <div class="file-list">
                <div
                  v-for="file in status.modified"
                  :key="file.path"
                  :class="['file-item', 'modified', { active: activeFile?.path === file.path }]"
                  @click="openDiff(file.path, false)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedFiles.includes(file.path)"
                    @click.stop
                    @change="toggleSelect(file.path)"
                  />
                  <span class="file-path">{{ file.path }}</span>
                </div>
              </div>
            </div>

            <!-- Untracked Files -->
            <div class="file-section" v-if="status.untracked.length > 0">
              <h3 class="section-title untracked">
                ✗ 未跟踪 ({{ status.untracked.length }})
              </h3>
              <div class="file-list">
                <div
                  v-for="file in status.untracked"
                  :key="file.path"
                  :class="['file-item', 'untracked', { active: activeFile?.path === file.path }]"
                  @click="openDiff(file.path, false)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedFiles.includes(file.path)"
                    @click.stop
                    @change="toggleSelect(file.path)"
                  />
                  <span class="file-path">{{ file.path }}</span>
                  <button class="btn-icon" @click.stop="ignoreSingle(file.path)" title="添加到 .gitignore">
                    ⊘
                  </button>
                </div>
              </div>
            </div>

            <!-- Deleted Files -->
            <div class="file-section" v-if="status.deleted.length > 0">
              <h3 class="section-title deleted">
                ✖ 已删除 ({{ status.deleted.length }})
              </h3>
              <div class="file-list">
                <div
                  v-for="file in status.deleted"
                  :key="file.path"
                  :class="['file-item', 'deleted', { active: activeFile?.path === file.path }]"
                  @click="openDiff(file.path, false)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedFiles.includes(file.path)"
                    @click.stop
                    @change="toggleSelect(file.path)"
                  />
                  <span class="file-path">{{ file.path }}</span>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div class="empty-state" v-if="!hasChanges">
              <p>✓ 工作区干净，没有变更</p>
            </div>
          </div>
        </div>

        <!-- Diff Viewer (Right) -->
        <div class="changes-right">
          <div class="diff-viewer" v-if="activeFile">
            <div class="diff-viewer-header">
              <div class="diff-title">
                {{ activeFile.path }}{{ activeFile.staged ? ' (已暂存)' : ' (未暂存)' }}
              </div>
              <button class="btn-clear" @click="clearDiff" title="清空预览">✕</button>
            </div>

            <div class="diff-columns">
              <div class="diff-pane">
                <div class="diff-pane-title">本地文件</div>
                <pre class="diff-content"><div v-for="(l, i) in localLines" :key="`l-${i}`" :class="['diff-line', { changed: l.changed }]"><template v-for="(seg, si) in l.segments" :key="`ls-${i}-${si}`"><span :class="seg.kind"><template v-for="(t, ti) in seg.tokens" :key="`lst-${i}-${si}-${ti}`"><span :class="t.kind">{{ t.text }}</span></template></span></template></div></pre>
              </div>
              <div class="diff-pane">
                <div class="diff-pane-title">Git 当前（HEAD）</div>
                <pre class="diff-content"><div v-for="(l, i) in gitLines" :key="`r-${i}`" :class="['diff-line', { changed: l.changed }]"><template v-for="(seg, si) in l.segments" :key="`rs-${i}-${si}`"><span :class="seg.kind"><template v-for="(t, ti) in seg.tokens" :key="`rst-${i}-${si}-${ti}`"><span :class="t.kind">{{ t.text }}</span></template></span></template></div></pre>
              </div>
            </div>
          </div>

          <div class="diff-placeholder" v-else>
            <div class="diff-placeholder-title">差异预览</div>
            <div class="diff-placeholder-text">点击左侧文件行，在此处加载对比。</div>
          </div>
        </div>
      </div>

      <!-- Non-changes modes -->
      <template v-else>
        <textarea v-if="mode === 'textarea'" placeholder="提交信息..."></textarea>
        <div v-else-if="mode === 'sync'">
          <button>拉取</button>
          <button>推送</button>
        </div>
        <p v-else>{{ readyText }}</p>
      </template>
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
const localContent = ref('')
const gitContent = ref('')
const localLines = ref([])
const gitLines = ref([])
const activeFile = ref(null)

function splitLines(s) {
  if (!s) return []
  // keep final empty line implicit; render aligns via placeholders
  return s.replace(/\r\n/g, '\n').split('\n')
}

function tokenizeVsCodeLike(text) {
  const s = text ?? ''
  if (s === '') return [{ kind: 'tok-plain', text: '' }]

  const out = []
  let i = 0

  const push = (kind, t) => {
    if (t === '') return
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += t
    else out.push({ kind, text: t })
  }

  const isWordChar = (c) => /[A-Za-z0-9_$]/.test(c)
  const keywords = new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch',
    'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'class',
    'extends', 'import', 'export', 'default', 'from', 'true', 'false', 'null', 'undefined',
    'module', 'exports', 'require'
  ])

  while (i < s.length) {
    const ch = s[i]

    // Line comment
    if (ch === '/' && s[i + 1] === '/') {
      push('tok-comment', s.slice(i))
      break
    }

    // Whitespace
    if (ch === ' ' || ch === '\t') {
      let j = i + 1
      while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++
      push('tok-plain', s.slice(i, j))
      i = j
      continue
    }

    // String
    if (ch === '\'' || ch === '"' || ch === '`') {
      const quote = ch
      let j = i + 1
      while (j < s.length) {
        const c = s[j]
        if (c === '\\') { j += 2; continue }
        if (c === quote) { j++; break }
        j++
      }
      push('tok-string', s.slice(i, j))
      i = j
      continue
    }

    // Number / IP-ish segments
    if (/[0-9]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[0-9._]/.test(s[j])) j++
      push('tok-number', s.slice(i, j))
      i = j
      continue
    }

    // Identifier / keyword / property (simple heuristic)
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1
      while (j < s.length && isWordChar(s[j])) j++
      const word = s.slice(i, j)
      const next = s[j]
      if (keywords.has(word)) push('tok-keyword', word)
      else if (next === ':' || next === '.') push('tok-property', word)
      else push('tok-plain', word)
      i = j
      continue
    }

    // Punctuation / operators
    push('tok-punct', ch)
    i++
  }

  return out.length ? out : [{ kind: 'tok-plain', text: s }]
}

function mkSeg(kind, text) {
  const t = text ?? ''
  return {
    kind,
    text: t,
    tokens: tokenizeVsCodeLike(t)
  }
}

function splitInlineDiff(aLine, bLine) {
  const a = aLine ?? ''
  const b = bLine ?? ''

  if (a === b) {
    return {
      left: [mkSeg('seg-eq', a || ' ')],
      right: [mkSeg('seg-eq', b || ' ')]
    }
  }

  // Character-level LCS so multiple separated diffs highlight precisely.
  const A = [...a]
  const B = [...b]

  const maxChars = 1200
  if (A.length > maxChars || B.length > maxChars) {
    return {
      left: [{ kind: 'seg-diff', text: a || ' ' }],
      right: [{ kind: 'seg-diff', text: b || ' ' }]
    }
  }

  const n = A.length
  const m = B.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = A[i - 1] === B[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const ops = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) {
      ops.push({ type: 'eq', ch: A[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'ins', ch: B[j - 1] })
      j--
    } else {
      ops.push({ type: 'del', ch: A[i - 1] })
      i--
    }
  }
  ops.reverse()

  const left = []
  const right = []

  const pushSeg = (arr, kind, ch) => {
    if (ch === '') return
    const last = arr[arr.length - 1]
    if (last && last.kind === kind) {
      last.text += ch
      last.tokens = tokenizeVsCodeLike(last.text)
    } else {
      arr.push(mkSeg(kind, ch))
    }
  }

  for (const op of ops) {
    if (op.type === 'eq') {
      pushSeg(left, 'seg-eq', op.ch)
      pushSeg(right, 'seg-eq', op.ch)
    } else if (op.type === 'del') {
      pushSeg(left, 'seg-diff', op.ch)
    } else {
      pushSeg(right, 'seg-diff', op.ch)
    }
  }

  if (left.length === 0) left.push(mkSeg('seg-eq', ' '))
  if (right.length === 0) right.push(mkSeg('seg-eq', ' '))

  return { left, right }
}

function buildAlignedDiff(aText, bText) {
  const a = splitLines(aText)
  const b = splitLines(bText)

  // Avoid O(n*m) blowups on huge files.
  const maxLines = 2000
  if (a.length > maxLines || b.length > maxLines) {
    return {
      left: a.map(text => ({ text, changed: false, segments: [mkSeg('seg-eq', text || ' ')] })),
      right: b.map(text => ({ text, changed: false, segments: [mkSeg('seg-eq', text || ' ')] }))
    }
  }

  // LCS DP table
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to operations
  const ops = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'eq', a: a[i - 1], b: b[j - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'ins', b: b[j - 1] })
      j--
    } else {
      ops.push({ type: 'del', a: a[i - 1] })
      i--
    }
  }
  ops.reverse()

  // Merge adjacent delete+insert into a single "replace" row to avoid
  // creating artificial blank lines on either side.
  const merged = []
  for (let k = 0; k < ops.length; k++) {
    const cur = ops[k]
    const next = ops[k + 1]
    if (cur?.type === 'del' && next?.type === 'ins') {
      merged.push({ type: 'rep', a: cur.a, b: next.b })
      k++
      continue
    }
    merged.push(cur)
  }

  // Build aligned lines; mark non-eq as changed (blue)
  const left = []
  const right = []
  for (const op of merged) {
    if (op.type === 'eq') {
      left.push({ text: op.a, changed: false, segments: [mkSeg('seg-eq', op.a || ' ')] })
      right.push({ text: op.b, changed: false, segments: [mkSeg('seg-eq', op.b || ' ')] })
    } else if (op.type === 'rep') {
      const segs = splitInlineDiff(op.a || '', op.b || '')
      left.push({ text: op.a, changed: true, segments: segs.left })
      right.push({ text: op.b, changed: true, segments: segs.right })
    } else if (op.type === 'del') {
      const segs = splitInlineDiff(op.a || '', '')
      left.push({ text: op.a, changed: true, segments: segs.left })
      right.push({ text: '', changed: true, segments: segs.right })
    } else {
      const segs = splitInlineDiff('', op.b || '')
      left.push({ text: '', changed: true, segments: segs.left })
      right.push({ text: op.b, changed: true, segments: segs.right })
    }
  }

  // For pairs where both sides are "changed" and have text, add inline diff segments.
  for (let k = 0; k < Math.max(left.length, right.length); k++) {
    const l = left[k]
    const r = right[k]
    if (!l || !r) continue
    if (!l.changed && !r.changed) continue
    if ((l.text || '') === '' && (r.text || '') === '') continue

    const segs = splitInlineDiff(l.text || '', r.text || '')
    l.segments = segs.left
    r.segments = segs.right
  }

  return { left, right }
}

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
  
  const versions = await window.electronAPI.getFileVersions(props.currentRepo.path, filePath)
  localContent.value = versions?.localContent ?? '(无法读取本地文件)'
  gitContent.value = versions?.gitContent ?? '(无法读取 Git 当前版本)'

  const aligned = buildAlignedDiff(localContent.value, gitContent.value)
  localLines.value = aligned.left
  gitLines.value = aligned.right

  activeFile.value = { path: filePath, staged: !!staged }
}

function openDiff(filePath, staged) {
  viewDiff(filePath, staged)
}

function clearDiff() {
  activeFile.value = null
  localContent.value = ''
  gitContent.value = ''
  localLines.value = []
  gitLines.value = []
}

// Watch for repo changes
watch(() => props.currentRepo, () => {
  if (props.currentRepo) {
    loadStatus()
    clearDiff()
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

.file-item.active {
  outline: 1px solid rgba(78, 201, 176, 0.45);
  background: rgba(78, 201, 176, 0.08);
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

/* Changes layout: left list + right diff viewer */
.changes-layout {
  display: grid;
  grid-template-columns: var(--changes-left-width, 200px) 1fr;
  gap: 12px;
  height: calc(100% - 64px);
  min-height: 520px;
}

.changes-left {
  min-width: 0;
}

.changes-right {
  min-width: 0;
  display: flex;
}

.diff-viewer,
.diff-placeholder {
  flex: 1;
  background: #252526;
  border-radius: 8px;
  border: 1px solid #3c3c3c;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diff-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #3c3c3c;
  background: #2d2d2d;
}

.diff-title {
  font-size: 12px;
  color: #d4d4d4;
  word-break: break-all;
}

.btn-clear {
  background: transparent !important;
  padding: 4px 8px !important;
  font-size: 16px;
}

.diff-placeholder-title {
  padding: 10px 12px;
  border-bottom: 1px solid #3c3c3c;
  background: #2d2d2d;
  color: #aaa;
  font-size: 12px;
}

.diff-placeholder-text {
  padding: 16px;
  color: #888;
  font-size: 13px;
}

.diff-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  flex: 1;
  min-height: 0;
}

.diff-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  overflow: hidden;
}

.diff-pane-title {
  padding: 8px 12px;
  font-size: 12px;
  color: #aaa;
  background: #2d2d2d;
  border-bottom: 1px solid #3c3c3c;
}

.diff-content {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
  word-break: normal;
  color: #d4d4d4;
  background: #1e1e1e;
}

.diff-line {
  padding: 0 6px;
  border-left: 3px solid transparent;
}

.diff-line.changed {
  background: rgba(30, 144, 255, 0.18);
  border-left-color: rgba(30, 144, 255, 0.75);
}

.seg-eq {
  color: inherit;
}

.seg-diff {
  /* 只标差异片段：不改字体颜色，只加深蓝背景 */
  color: inherit;
  background: rgba(30, 100, 220, 0.65);
  box-shadow: inset 0 0 0 1px rgba(120, 180, 255, 0.55);
  border-radius: 2px;
  padding: 0 2px;
}

/* VSCode Dark+ 风格语法色（轻量版） */
.tok-comment {
  color: #6a9955;
}

.tok-string {
  color: #ce9178;
}

.tok-number {
  color: #b5cea8;
}

.tok-keyword {
  color: #569cd6;
}

.tok-property {
  color: #9cdcfe;
}

.tok-punct {
  color: #d4d4d4;
}

.tok-plain {
  color: #d4d4d4;
}

@media (max-width: 900px) {
  .changes-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .diff-columns {
    grid-template-columns: 1fr;
  }
}
</style>