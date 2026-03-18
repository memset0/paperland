<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()
const newTokenValue = ref<string | null>(null)

onMounted(() => {
  store.fetchTokens()
})

async function issueNew() {
  newTokenValue.value = await store.issueToken()
}
</script>

<template>
  <div class="settings">
    <h1>设置</h1>

    <section class="token-section">
      <div class="section-header">
        <h2>API Token 管理</h2>
        <button class="btn primary" @click="issueNew">签发新 Token</button>
      </div>

      <div v-if="newTokenValue" class="new-token-banner">
        <p><strong>新 Token 已生成（仅显示一次）:</strong></p>
        <code>{{ newTokenValue }}</code>
        <button class="btn" @click="newTokenValue = null">关闭</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>创建时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="token in store.tokens" :key="token.id">
            <td><code>{{ token.token }}</code></td>
            <td>{{ new Date(token.created_at).toLocaleString() }}</td>
            <td>{{ token.revoked_at ? '已撤销' : '有效' }}</td>
            <td>
              <button v-if="!token.revoked_at" class="btn danger" @click="store.revokeToken(token.id)">撤销</button>
            </td>
          </tr>
          <tr v-if="store.tokens.length === 0">
            <td colspan="4" class="empty">暂无 Token</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
h1 { font-size: 24px; margin-bottom: 24px; }
h2 { font-size: 18px; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn.primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.btn.danger { background: #d93025; color: #fff; border-color: #d93025; }

.new-token-banner {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.new-token-banner code {
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  flex: 1;
  word-break: break-all;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
th { background: #fafafa; font-weight: 600; font-size: 13px; color: #666; }

code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }

.empty { text-align: center; color: #999; padding: 24px; }
</style>
