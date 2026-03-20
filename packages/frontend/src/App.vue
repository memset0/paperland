<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { FileText, MessageSquare, Activity, Settings, BookOpen, Menu, X, Github } from 'lucide-vue-next'
import GlobalAlert from '@/components/GlobalAlert.vue'

const route = useRoute()
const router = useRouter()
const isMobile = ref(window.innerWidth < 768)
const drawerOpen = ref(false)

function onResize() { isMobile.value = window.innerWidth < 768 }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

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

function navigateMobile(path: string) {
  router.push(path)
  drawerOpen.value = false
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50/50">
    <GlobalAlert />

    <!-- ========== DESKTOP: Icon sidebar ========== -->
    <aside v-if="!isMobile" class="flex w-[52px] flex-col border-r border-gray-200 bg-white shrink-0">
      <div class="flex h-12 items-center justify-center border-b border-gray-200">
        <BookOpen class="h-5 w-5 text-indigo-600" />
      </div>
      <nav class="flex-1 flex flex-col items-center gap-1 pt-3">
        <RouterLink
          v-for="item in navItems" :key="item.path" :to="item.path"
          :class="['group relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150',
            isActive(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600']"
        >
          <component :is="item.icon" :class="['h-[16px] w-[16px]', isActive(item.path) ? 'text-indigo-600' : '']" :stroke-width="isActive(item.path) ? 2.2 : 1.8" />
          <span class="pointer-events-none absolute left-full ml-2 z-[100] hidden whitespace-nowrap rounded-md bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="flex items-center justify-center pb-3">
        <a href="https://github.com/mem-research/paperland" target="_blank" rel="noopener noreferrer" class="group relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600">
          <Github class="h-[16px] w-[16px]" :stroke-width="1.8" />
          <span class="pointer-events-none absolute left-full ml-2 z-[100] hidden whitespace-nowrap rounded-md bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">GitHub</span>
        </a>
      </div>
    </aside>

    <!-- ========== MOBILE: Top navbar + Drawer ========== -->
    <template v-if="isMobile">
      <!-- Top navbar (fixed) -->
      <div class="fixed top-0 left-0 right-0 z-40 flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-3">
        <button @click="drawerOpen = true" class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition">
          <Menu class="h-5 w-5" />
        </button>
        <BookOpen class="h-4 w-4 text-indigo-600" />
        <span class="font-bold text-sm text-gray-900">Paperland</span>
      </div>

      <!-- Drawer backdrop -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="drawerOpen" class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" @click="drawerOpen = false"></div>
        </Transition>
      </Teleport>

      <!-- Drawer panel -->
      <Teleport to="body">
        <Transition name="slide">
          <div v-if="drawerOpen" class="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl">
            <div class="flex h-12 items-center justify-between border-b border-gray-100 px-4">
              <div class="flex items-center gap-2">
                <BookOpen class="h-5 w-5 text-indigo-600" />
                <span class="font-bold text-sm text-gray-900">Paperland</span>
              </div>
              <button @click="drawerOpen = false" class="rounded-md p-1 text-gray-400 hover:text-gray-600 transition">
                <X class="h-5 w-5" />
              </button>
            </div>
            <nav class="p-3 space-y-1">
              <button
                v-for="item in navItems" :key="item.path"
                @click="navigateMobile(item.path)"
                :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900']"
              >
                <component :is="item.icon" :class="['h-4 w-4 shrink-0', isActive(item.path) ? 'text-indigo-600' : '']" :stroke-width="isActive(item.path) ? 2.2 : 1.8" />
                {{ item.label }}
              </button>
            </nav>
          </div>
        </Transition>
      </Teleport>
    </template>

    <!-- ========== Main content ========== -->
    <main :class="['flex-1 overflow-y-auto', isMobile ? 'pt-12' : '']">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active { transition: transform 0.25s ease-out; }
.slide-leave-active { transition: transform 0.2s ease-in; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>
