import { createRouter, createWebHistory } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'

const routes = [
  {
    path: '/',
    name: 'papers',
    component: () => import('@/views/PaperList.vue'),
  },
  {
    path: '/papers/:id',
    name: 'paper-detail',
    component: () => import('@/views/PaperDetail.vue'),
  },
  {
    path: '/qa',
    name: 'qa',
    component: () => import('@/views/QAPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagManagement.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/services',
    name: 'services',
    component: () => import('@/views/ServiceDashboard.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/idea-forge',
    name: 'idea-forge',
    component: () => import('@/views/idea-forge/ProjectList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/idea-forge/:projectName',
    name: 'idea-forge-project',
    component: () => import('@/views/idea-forge/IdeaManager.vue'),
    meta: { requiresAuth: true },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Guard restricted routes. Anonymous users are prompted to log in (and kept on a
// public page); authenticated non-admins are turned away from admin-only pages.
router.beforeEach(async (to) => {
  const meta = to.meta as { requiresAuth?: boolean; requiresAdmin?: boolean }
  if (!meta.requiresAuth && !meta.requiresAdmin) return true

  const auth = useAuthStore()
  if (!auth.loaded) await auth.fetchMe()

  if (!auth.isAuthenticated) {
    useLoginPrompt().openLogin()
    return to.path === '/' ? false : '/'
  }
  if (meta.requiresAdmin && !auth.isAdmin) {
    toast.error('需要管理员权限')
    return to.path === '/' ? false : '/'
  }
  return true
})
