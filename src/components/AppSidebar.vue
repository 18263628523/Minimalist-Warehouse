<template>
  <aside class="sidebar">
    <div class="repo-info" v-if="currentRepo">
      <div class="repo-path" :title="currentRepo.path">
        {{ currentRepo.name }}
      </div>
      <div class="repo-status" :class="{ 'has-remote': hasRemote }">
        {{ hasRemote ? '已关联远程' : '未关联远程' }}
      </div>
    </div>
    <div class="repo-info empty" v-else>
      <div class="repo-path">未选择仓库</div>
      <div class="repo-status">请在「仓库」中打开仓库</div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  currentRepo: { type: Object, default: null },
  hasRemote: { type: Boolean, required: true }
})
</script>

<style scoped>
.sidebar {
  width: 220px;
  background: #252526;
  border-right: 1px solid #3c3c3c;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.repo-info {
  margin-top: 8px;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 4px;
  font-size: 12px;
}

.repo-info.empty {
  color: #888;
}

.repo-path {
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-status {
  color: #888;
}

.repo-status.has-remote {
  color: #4ec9b0;
}
</style>
