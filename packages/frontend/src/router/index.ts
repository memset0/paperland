import { createRouter, createWebHistory } from 'vue-router'
import { FileText, MessageSquare, Activity, Settings, Tag, CalendarDays, NotebookPen, Image as ImageIcon, Languages, Puzzle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
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
    meta: { requiresAdmin: true, title: 'Settings', icon: Settings },
  },
  {
    path: '/translation-test',
    name: 'translation-test',
    component: () => import('@/views/TranslationTest.vue'),
    meta: { requiresAdmin: true, title: 'Translation Stream Test', icon: Languages },
  },
  {
    path: '/conferences',
    name: 'conferences',
    component: () => import('@/views/ConferenceList.vue'),
    meta: { title: 'Conferences', icon: CalendarDays },
  },
  {
    path: '/conferences/:id',
    name: 'conference-detail',
    component: () => import('@/views/ConferenceDetail.vue'),
    meta: { title: 'Conference Detail', icon: CalendarDays },
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
// confirmed navigation; dynamic pages (e.g. paper detail) then
// refine the title in-view via usePageTitle once their data resolves.
router.afterEach((to) => {
  document.title = formatTitle(to.meta.title as string | undefined)
})
