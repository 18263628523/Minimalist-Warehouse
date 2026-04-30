<template>
  <div class="panel">
    <h2>{{ t('repoPanel.title') }}</h2>

    <div class="actions">
      <button @click="$emit('open-repo')" class="btn-primary">
        📂 {{ t('repoPanel.openLocal') }}
      </button>
      <button @click="$emit('create-repo')" class="btn-secondary">
        ➕ {{ t('repoPanel.createNew') }}
      </button>
    </div>

    <div class="current-repo" v-if="currentRepo">
      <h3>{{ t('repoPanel.currentRepo') }}</h3>
      <div class="repo-detail">
        <div class="detail-row">
          <span class="label">{{ t('repoPanel.pathLabel') }}</span>
          <span class="value">{{ currentRepo.path }}</span>
        </div>
        <div class="detail-row">
          <span class="label">{{ t('repoPanel.statusLabel') }}</span>
          <span class="value" :class="{ connected: hasRemote }">
            {{ hasRemote ? t('repo.linkedRemote') : t('repo.noRemote') }}
          </span>
        </div>
      </div>
    </div>

    <div class="recent-repos" v-if="recentRepos.length > 0">
      <h3>{{ t('repoPanel.recentTitle') }}</h3>
      <ul class="repo-list">
        <li
          v-for="repo in recentRepos"
          :key="repo.path"
          @click="$emit('switch-repo', repo)"
        >
          <span class="repo-name">{{ repo.name }}</span>
          <span class="repo-path-small">{{ repo.path }}</span>
        </li>
      </ul>
    </div>

    <div class="empty-state" v-else>
      <p>{{ t('repoPanel.emptyRecent') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  currentRepo: { type: Object, default: null },
  hasRemote: { type: Boolean, required: true },
  recentRepos: { type: Array, required: true }
})

defineEmits(['open-repo', 'create-repo', 'switch-repo'])

const { t } = useI18n()
</script>

<style scoped>
.panel h2 {
  font-size: 18px;
  margin-bottom: 20px;
}

.panel h3 {
  font-size: 14px;
  margin: 20px 0 12px;
  color: #969696;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

button {
  background: #0e639c;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #1177bb;
}

.btn-primary {
  background: #238636;
}

.btn-primary:hover {
  background: #2ea043;
}

.btn-secondary {
  background: #0e639c;
}

.current-repo {
  background: #1e1e1e;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.repo-detail {
  font-size: 13px;
}

.detail-row {
  display: flex;
  margin-bottom: 8px;
}

.detail-row .label {
  color: #888;
  flex: 0 0 auto;
  min-width: 3.5rem;
  padding-right: 8px;
}

.detail-row .value {
  flex: 1;
  word-break: break-all;
}

.detail-row .value.connected {
  color: #4ec9b0;
}

.repo-list {
  list-style: none;
}

.repo-list li {
  padding: 12px;
  background: #1e1e1e;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}

.repo-list li:hover {
  background: #2a2d2e;
}

.repo-name {
  display: block;
  font-weight: 500;
  margin-bottom: 4px;
}

.repo-path-small {
  display: block;
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  color: #888;
  font-size: 14px;
}
</style>
