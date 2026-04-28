<template>
  <div class="app-container">
    <header class="header">
      <h1>Git Client</h1>
    </header>
    <div class="main-content">
      <aside class="sidebar">
        <nav>
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>
        </nav>
      </aside>
      <main class="content">
        <div v-if="activeTab === 'changes'" class="panel">
          <h2>文件变更</h2>
          <p>暂无可用变更</p>
        </div>
        <div v-else-if="activeTab === 'commit'" class="panel">
          <h2>提交</h2>
          <textarea placeholder="提交信息..."></textarea>
        </div>
        <div v-else-if="activeTab === 'branches'" class="panel">
          <h2>分支管理</h2>
          <p>暂无分支</p>
        </div>
        <div v-else-if="activeTab === 'log'" class="panel">
          <h2>提交历史</h2>
          <p>暂无提交记录</p>
        </div>
        <div v-else-if="activeTab === 'sync'" class="panel">
          <h2>远程同步</h2>
          <button>拉取</button>
          <button>推送</button>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('changes')
const tabs = [
  { id: 'changes', name: '变更' },
  { id: 'commit', name: '提交' },
  { id: 'branches', name: '分支' },
  { id: 'log', name: '日志' },
  { id: 'sync', name: '同步' }
]
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e1e;
  color: #d4d4d4;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header {
  padding: 16px 24px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
}

.header h1 {
  font-size: 18px;
  font-weight: 500;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 160px;
  background: #252526;
  border-right: 1px solid #3c3c3c;
  padding: 8px;
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
}

.tab-btn:hover {
  background: #2a2d2e;
}

.tab-btn.active {
  background: #37373d;
}

.content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.panel h2 {
  font-size: 16px;
  margin-bottom: 16px;
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
}

button {
  background: #0e639c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 8px;
}

button:hover {
  background: #1177bb;
}
</style>