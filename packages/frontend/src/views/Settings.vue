<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()
const newTokenValue = ref<string | null>(null)
const issuing = ref(false)

onMounted(() => {
  store.fetchTokens()
})

async function issueNew() {
  issuing.value = true
  try {
    newTokenValue.value = await store.issueToken()
  } finally {
    issuing.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-h4 mb-6">设置</h1>

    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-key</v-icon>
        API Token 管理
        <v-spacer />
        <v-btn color="primary" prepend-icon="mdi-plus" :loading="issuing" @click="issueNew">
          签发新 Token
        </v-btn>
      </v-card-title>

      <v-card-text v-if="newTokenValue">
        <v-alert type="success" closable @click:close="newTokenValue = null" class="mb-4">
          <div class="font-weight-bold mb-1">新 Token 已生成（仅显示一次）</div>
          <code class="d-block pa-2 bg-grey-lighten-4 rounded">{{ newTokenValue }}</code>
        </v-alert>
      </v-card-text>

      <v-data-table
        :headers="[
          { title: 'Token', key: 'token' },
          { title: '创建时间', key: 'created_at' },
          { title: '状态', key: 'status' },
          { title: '操作', key: 'actions', sortable: false, width: '100px' },
        ]"
        :items="store.tokens"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.token="{ item }">
          <code>{{ item.token }}</code>
        </template>
        <template #item.created_at="{ item }">
          {{ new Date(item.created_at).toLocaleString() }}
        </template>
        <template #item.status="{ item }">
          <v-chip :color="item.revoked_at ? 'error' : 'success'" size="small" variant="tonal">
            {{ item.revoked_at ? '已撤销' : '有效' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            v-if="!item.revoked_at"
            color="error"
            variant="tonal"
            size="small"
            @click="store.revokeToken(item.id)"
          >
            撤销
          </v-btn>
        </template>
        <template #no-data>
          <div class="text-center pa-6 text-grey">暂无 Token</div>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>
