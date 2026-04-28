<template>
  <div class="panel">
    <h2>{{ title }}</h2>

    <p v-if="!currentRepo" class="no-repo">
      请先在「仓库管理」中打开一个 Git 仓库
    </p>

    <template v-else>
      <textarea v-if="mode === 'textarea'" placeholder="提交信息..."></textarea>
      <div v-else-if="mode === 'sync'">
        <button>拉取</button>
        <button>推送</button>
      </div>
      <p v-else>{{ readyText }}</p>
    </template>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  readyText: { type: String, required: true },
  currentRepo: { type: Object, default: null },
  mode: { type: String, default: 'text' }
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

button {
  background: #0e639c;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
}

button:hover {
  background: #1177bb;
}

textarea {
  width: 100%;
  height: 120px;
  background: #252526;
  border: 1px solid #3c3c3c;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
}
</style>
