import { createRouter, createWebHistory } from 'vue-router'
import { FileText, MessageSquare, Activity, Settings, Tag, NotebookPen, Image as ImageIcon, Languages, Puzzle, Telescope } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { formatTitle } from '@/composables/usePageTitle'

const routes = [
  {
    path: '/',
    name: 'papers',
    component: () => import('@/views/PaperList.vue'),
    meta: { title: 'Papers', icon: FileText },
  },
  {
    path: '/papers/:id',
    name: 'paper-detail',
    component: () => import('@/views/PaperDetail.vue'),
    // Placeholder until the paper loads; PaperDetail overrides with the paper title.
    meta: { title: 'Paper Detail' },
  },
  {
    // Browser-extension quick-open link: /open/arxiv/<arxiv_id>?token=<token>. The `(.*)`
    // keeps old-style ids (hep-th/9901001) in one param. Intentionally no requiresAuth —
    // the view handles login itself so the target is not lost.
    path: '/open/arxiv/:arxiv_id(.*)',
    name: 'open-arxiv',
    component: () => import('@/views/OpenArxiv.vue'),
    meta: { title: 'Opening Paper' },
  },
  {
    path: '/qa',
    name: 'qa',
    component: () => import('@/views/QAPage.vue'),
    meta: { requiresAuth: true, title: 'Q&A', icon: MessageSquare },
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('@/views/NotesPage.vue'),
    meta: { requiresAuth: true, title: 'Notes', icon: NotebookPen },
  },
  {
    path: '/research',
    name: 'research',
    component: () => import('@/views/ResearchList.vue'),
    meta: { requiresAuth: true, title: 'Research', icon: Telescope },
  },
  {
    path: '/research/:id',
    name: 'research-detail',
    component: () => import('@/views/ResearchDetail.vue'),
    // Placeholder until the session loads; ResearchDetail overrides with the session title.
    meta: { requiresAuth: true, title: 'Research' },
  },
  {
    path: '/images',
    name: 'image-host',
    component: () => import('@/views/ImageHostPage.vue'),
    meta: { requiresAuth: true, title: 'Images', icon: ImageIcon },
  },
  {
    path: '/extension',
    name: 'extension',
    component: () => import('@/views/ExtensionPage.vue'),
    meta: { requiresAuth: true, title: 'Extension', icon: Puzzle },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagManagement.vue'),
    meta: { requiresAuth: true, title: 'Tags', icon: Tag },
  },
  {
    path: '/services',
    name: 'services',
    component: () => import('@/views/ServiceDashboard.vue'),
    meta: { requiresAdmin: true, title: 'Services', icon: Activity },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true, title: 'Settings', icon: Settings },
  },
  {
    path: '/translation-test',
    name: 'translation-test',
    component: () => import('@/views/TranslationTest.vue'),
    meta: { requiresAdmin: true, title: 'Translation Stream Test', icon: Languages },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Guard restricted routes. Every route needs login, which App enforces by showing the login
// screen to anonymous visitors; here authenticated non-admins are turned away from admin-only pages.
router.beforeEach(async (to) => {
  const meta = to.meta as { requiresAuth?: boolean; requiresAdmin?: boolean }
  if (!meta.requiresAuth && !meta.requiresAdmin) return true

  const auth = useAuthStore()
  if (!auth.loaded) await auth.fetchMe()

  // Anonymous: let the navigation through — App renders the login screen instead of the route,
  // and the requested route appears once they log in.
  if (!auth.isAuthenticated) return true
  if (meta.requiresAdmin && !auth.isAdmin) {
    toast.error('Admin access required')
    return to.path === '/' ? false : '/'
  }
  return true
})

// Keep the browser tab title in sync with the page. Runs synchronously on every
// confirmed navigation; dynamic pages (e.g. paper detail) then
// refine the title in-view via usePageTitle once their data resolves.
router.afterEach((to) => {
  document.title = formatTitle(to.meta.title as string | undefined)
})
