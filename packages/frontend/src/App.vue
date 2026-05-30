<script setup lang="ts">
import { ref, onMounted, onUnmounted, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { FileText, MessageSquare, Activity, Settings, BookOpen, Menu, Tag, Lightbulb, LogIn, CircleUser, CalendarDays, NotebookPen } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useEmbedMode } from '@/composables/useEmbedMode'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { useAuthStore } from '@/stores/auth'
import { onUnauthorized } from '@/lib/error-bus'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import LoginDialog from '@/components/LoginDialog.vue'
import AccountDialog from '@/components/AccountDialog.vue'
import NoteWindowHost from '@/components/notes/NoteWindowHost.vue'

const route = useRoute()
const router = useRouter()
const isMobile = ref(window.innerWidth < 768)
const drawerOpen = ref(false)
const accountOpen = ref(false)
const { isEmbed, bgColor } = useEmbedMode()
const { openLogin } = useLoginPrompt()
const auth = useAuthStore()

watchEffect(() => {
  if (bgColor.value) {
    document.documentElement.style.backgroundColor = bgColor.value
  }
})

function onResize() { isMobile.value = window.innerWidth < 768 }
let unsub: (() => void) | null = null
onMounted(() => {
  window.addEventListener('resize', onResize)
  if (!auth.loaded) auth.fetchMe()
  unsub = onUnauthorized(() => openLogin())
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  unsub?.()
})

interface NavItem { path: string; label: string; icon: any; requiresAuth?: boolean; requiresAdmin?: boolean }
const navItems: NavItem[] = [
  { path: '/', label: 'Papers', icon: FileText },
  { path: '/conferences', label: 'Conferences', icon: CalendarDays },
  { path: '/tags', label: 'Tags', icon: Tag, requiresAuth: true },
  { path: '/qa', label: 'Q&A', icon: MessageSquare, requiresAuth: true },
  { path: '/notes', label: 'Notes', icon: NotebookPen, requiresAuth: true },
  { path: '/idea-forge', label: 'Idea Forge', icon: Lightbulb, requiresAuth: true },
  { path: '/services', label: 'Services', icon: Activity, requiresAdmin: true },
  { path: '/settings', label: 'Settings', icon: Settings, requiresAdmin: true },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/' || route.path.startsWith('/papers/')
  return route.path.startsWith(path)
}

/** Whether the current user may navigate to this item without gating. */
function isAccessible(item: NavItem) {
  if (item.requiresAdmin && !auth.isAdmin) return false
  if (item.requiresAuth && !auth.isAuthenticated) return false
  return true
}

/** Real href for accessible items so the browser can open them in a new tab; undefined for gated items. */
function navHref(item: NavItem) {
  return isAccessible(item) ? router.resolve(item.path).href : undefined
}

/** Navigate to a nav item, gating restricted items behind login/admin.
 *  Modifier-click on an accessible item is left to the browser (open in new tab). */
function onNavClick(e: MouseEvent, item: NavItem) {
  if (isAccessible(item) && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return
  e.preventDefault()
  drawerOpen.value = false
  if (item.requiresAdmin && !auth.isAdmin) {
    if (!auth.isAuthenticated) openLogin()
    else toast.error('Admin access required')
    return
  }
  if (item.requiresAuth && !auth.isAuthenticated) {
    openLogin()
    return
  }
  if (route.path !== item.path) router.push(item.path)
}

async function doLogout() {
  await auth.logout()
  toast.success('Logged out')
  // Leave restricted pages on logout.
  const meta = route.meta as { requiresAuth?: boolean; requiresAdmin?: boolean }
  if (meta.requiresAuth || meta.requiresAdmin) router.push('/')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden" :style="bgColor ? { backgroundColor: bgColor } : {}" :class="!bgColor ? 'bg-muted/40' : ''">
    <Toaster position="top-center" richColors />
    <LoginDialog />
    <AccountDialog v-model:open="accountOpen" />

    <!-- ========== DESKTOP: Icon sidebar ========== -->
    <aside v-if="!isMobile && !isEmbed" class="flex w-[52px] flex-col border-r bg-background shrink-0 [&_button]:active:translate-y-0! [&_a]:active:translate-y-0!">
      <div class="flex h-12 items-center justify-center border-b">
        <BookOpen class="h-5 w-5 text-primary" />
      </div>
      <TooltipProvider :delay-duration="100">
        <nav class="flex-1 flex flex-col items-center gap-1 pt-3">
          <Tooltip v-for="item in navItems" :key="item.path">
            <TooltipTrigger as-child>
              <Button
                as-child
                variant="ghost"
                size="icon"
                :class="isActive(item.path) ? 'bg-accent text-accent-foreground' : ''"
              >
                <a :href="navHref(item)" @click="onNavClick($event, item)">
                  <component :is="item.icon" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {{ item.label }}
              <span v-if="item.requiresAdmin && !auth.isAdmin" class="opacity-70">(Admin only)</span>
              <span v-else-if="item.requiresAuth && !auth.isAuthenticated" class="opacity-70">(Login required)</span>
            </TooltipContent>
          </Tooltip>
        </nav>
        <div class="flex flex-col items-center gap-1 pb-3">
          <!-- Account menu / login -->
          <Tooltip v-if="!auth.isAuthenticated">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" @click="openLogin()">
                <LogIn />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Login</TooltipContent>
          </Tooltip>
          <DropdownMenu v-else>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon">
                <CircleUser />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" class="w-44">
              <DropdownMenuLabel>
                {{ auth.user?.username }}
                <span v-if="auth.isAdmin" class="text-xs text-muted-foreground">(Admin)</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="accountOpen = true">Account settings</DropdownMenuItem>
              <DropdownMenuItem @click="doLogout">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button as-child variant="ghost" size="icon">
                <a href="https://github.com/mem-research/paperland" target="_blank" rel="noopener noreferrer">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-2.07c-3.2.69-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.44-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.7 5.36-5.27 5.65.41.35.78 1.05.78 2.12v3.14c0 .31.21.66.8.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z"/>
                  </svg>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">GitHub</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>

    <!-- ========== MOBILE: Top navbar + Drawer ========== -->
    <template v-if="isMobile && !isEmbed">
      <div class="fixed top-0 left-0 right-0 z-40 flex h-12 items-center gap-3 border-b bg-background px-3">
        <Sheet v-model:open="drawerOpen">
          <SheetTrigger as-child>
            <Button variant="ghost" size="icon-sm">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-64 p-0 [&_button]:active:translate-y-0! [&_a]:active:translate-y-0!">
            <SheetHeader class="border-b px-4 py-3">
              <SheetTitle class="flex items-center gap-2 text-sm">
                <BookOpen class="h-4 w-4 text-primary" />
                Paperland
              </SheetTitle>
            </SheetHeader>
            <nav class="p-2 space-y-1">
              <Button
                v-for="item in navItems" :key="item.path"
                as-child
                variant="ghost"
                size="lg"
                :class="['w-full justify-start gap-3', isActive(item.path) ? 'bg-accent text-accent-foreground' : '']"
              >
                <a :href="navHref(item)" @click="onNavClick($event, item)">
                  <component :is="item.icon" />
                  {{ item.label }}
                  <span v-if="item.requiresAdmin && !auth.isAdmin" class="ml-auto text-xs text-muted-foreground">Admin only</span>
                  <span v-else-if="item.requiresAuth && !auth.isAuthenticated" class="ml-auto text-xs text-muted-foreground">Login required</span>
                </a>
              </Button>
            </nav>
            <div class="border-t p-2 space-y-1">
              <Button
                v-if="!auth.isAuthenticated"
                variant="ghost" size="lg" class="w-full justify-start gap-3"
                @click="drawerOpen = false; openLogin()"
              >
                <LogIn /> Login
              </Button>
              <template v-else>
                <Button variant="ghost" size="lg" class="w-full justify-start gap-3" @click="drawerOpen = false; accountOpen = true">
                  <CircleUser /> {{ auth.user?.username }}
                </Button>
                <Button variant="ghost" size="lg" class="w-full justify-start gap-3" @click="drawerOpen = false; doLogout()">
                  <LogIn class="rotate-180" /> Logout
                </Button>
              </template>
            </div>
          </SheetContent>
        </Sheet>
        <BookOpen class="h-4 w-4 text-primary" />
        <span class="font-bold text-sm">Paperland</span>
      </div>
    </template>

    <!-- ========== Main content ========== -->
    <main :class="['flex-1 overflow-y-auto overflow-x-hidden', isMobile && !isEmbed ? 'pt-12' : '']">
      <RouterView />
    </main>

    <!-- Floating note editor windows (above app chrome) -->
    <NoteWindowHost />
  </div>
</template>
