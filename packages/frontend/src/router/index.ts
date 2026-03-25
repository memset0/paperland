import { createRouter, createWebHistory } from 'vue-router'

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
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagManagement.vue'),
  },
  {
    path: '/services',
    name: 'services',
    component: () => import('@/views/ServiceDashboard.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
  },
  {
    path: '/idea-forge',
    name: 'idea-forge',
    component: () => import('@/views/idea-forge/ProjectList.vue'),
  },
  {
    path: '/idea-forge/:projectName',
    name: 'idea-forge-project',
    component: () => import('@/views/idea-forge/IdeaManager.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
