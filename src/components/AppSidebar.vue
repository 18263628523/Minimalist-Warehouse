<template>
  <aside class="sidebar">
    <nav>
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="$emit('change-tab', tab.id)"
      >
        {{ tab.name }}
      </button>
    </nav>

    <div class="repo-info" v-if="currentRepo">
      <div class="repo-path" :title="currentRepo.path">
        {{ currentRepo.name }}
      </div>
      <div class="repo-status" :class="{ 'has-remote': hasRemote }">
        {{ hasRemote ? '已关联远程' : '未关联远程' }}
      </div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  currentRepo: { type: Object, default: null },
  hasRemote: { type: Boolean, required: true }
})

defineEmits(['change-tab'])
</script>

<style scoped>
.sidebar {
  width: 180px;
  background: #252526;
  border-right: 1px solid #3c3c3c;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.tab-btn {
  display: block;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  color: #d4d4d4;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 14px;
}

.tab-btn:hover {
  background: #2a2d2e;
}

.tab-btn.active {
  background: #37373d;
}

.repo-info {
  margin-top: auto;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 4px;
  font-size: 12px;
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
