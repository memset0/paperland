import { createRouter, createWebHistory } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { formatTitle } from '@/composables/usePageTitle'

const routes = [
  {
    path: '/',
    name: 'papers',
    component: () => import('@/views/PaperList.vue'),
    meta: { title: 'Papers' },
  },
  {
    path: '/papers/:id',
    name: 'paper-detail',
    component: () => import('@/views/PaperDetail.vue'),
    // Placeholder until the paper loads; PaperDetail overrides with the paper title.
    meta: { title: 'Paper Detail' },
  },
  {
    path: '/qa',
    name: 'qa',
    component: () => import('@/views/QAPage.vue'),
    meta: { requiresAuth: true, title: 'Q&A' },
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('@/views/NotesPage.vue'),
    meta: { requiresAuth: true, title: 'Notes' },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagManagement.vue'),
    meta: { requiresAuth: true, title: 'Tags' },
  },
  {
    path: '/services',
    name: 'services',
    component: () => import('@/views/ServiceDashboard.vue'),
    meta: { requiresAdmin: true, title: 'Services' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAdmin: true, title: 'Settings' },
  },
  {
    path: '/conferences',
    name: 'conferences',
    component: () => import('@/views/ConferenceList.vue'),
    meta: { title: 'Conferences' },
  },
  {
    path: '/conferences/:id',
    name: 'conference-detail',
    component: () => import('@/views/ConferenceDetail.vue'),
    meta: { title: 'Conference Detail' },
  },
  {
    path: '/idea-forge',
    name: 'idea-forge',
    component: () => import('@/views/idea-forge/ProjectList.vue'),
    meta: { requiresAuth: true, title: 'Idea Forge' },
  },
  {
    path: '/idea-forge/:projectName',
    name: 'idea-forge-project',
    component: () => import('@/views/idea-forge/IdeaManager.vue'),
    // Placeholder until projects load; IdeaManager overrides with the project name.
    meta: { requiresAuth: true, title: 'Idea Forge' },
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
    toast.error('Admin access required')
    return to.path === '/' ? false : '/'
  }
  return true
})

// Keep the browser tab title in sync with the page. Runs synchronously on every
// confirmed navigation; dynamic pages (paper detail, idea-forge project) then
// refine the title in-view via usePageTitle once their data resolves.
router.afterEach((to) => {
  document.title = formatTitle(to.meta.title as string | undefined)
})
