<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { FileText, MessageSquare, Activity, Settings, ChevronLeft, ChevronRight, BookOpen } from 'lucide-vue-next'

const route = useRoute()
const collapsed = ref(false)

const navItems = [
  { path: '/', label: '论文管理', icon: FileText },
  { path: '/qa', label: 'Q&A', icon: MessageSquare },
  { path: '/services', label: '服务管理', icon: Activity },
  { path: '/settings', label: '设置', icon: Settings },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/' || route.path.startsWith('/papers/')
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50/50">
    <aside :class="['flex flex-col border-r border-gray-200 bg-white transition-all duration-200 shrink-0', collapsed ? 'w-[52px]' : 'w-52']">
      <div class="flex h-14 items-center gap-2.5 border-b border-gray-100 px-3.5">
        <BookOpen class="h-5 w-5 shrink-0 text-indigo-600" />
        <span v-if="!collapsed" class="font-bold text-[15px] tracking-tight text-gray-900">Paperland</span>
      </div>
      <nav class="flex-1 space-y-0.5 p-2 pt-3">
        <RouterLink
          v-for="item in navItems" :key="item.path" :to="item.path"
          :class="['flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150',
            isActive(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700']"
        >
          <component :is="item.icon" :class="['h-[15px] w-[15px] shrink-0', isActive(item.path) ? 'text-indigo-600' : '']" :stroke-width="isActive(item.path) ? 2.2 : 1.8" />
          <span v-if="!collapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>
      <button @click="collapsed = !collapsed" class="flex h-9 items-center justify-center border-t border-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
        <ChevronLeft v-if="!collapsed" class="h-3.5 w-3.5" />
        <ChevronRight v-else class="h-3.5 w-3.5" />
      </button>
    </aside>
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>
