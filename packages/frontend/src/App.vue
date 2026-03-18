<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useRouter } from 'vue-router'

const router = useRouter()

const navItems = [
  { title: '论文管理', icon: 'mdi-file-document-multiple', to: '/' },
  { title: 'Q&A', icon: 'mdi-chat-question', to: '/qa' },
  { title: '服务管理', icon: 'mdi-cog-transfer', to: '/services' },
  { title: '设置', icon: 'mdi-cog', to: '/settings' },
]
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>
        <span class="font-weight-bold cursor-pointer" @click="router.push('/')">Paperland</span>
      </v-app-bar-title>
      <template v-slot:append>
        <v-btn
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          variant="text"
          class="text-none"
        >
          {{ item.title }}
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>
