<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Archive, ArchiveRestore, Ellipsis, GitBranch, History, Library, Pencil, RefreshCw, ScrollText, Search, Share2 } from '@lucide/vue'
import type { TopicDetail } from '@paperland/shared'
import { relativeTime } from '@/lib/relative-time'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

defineProps<{ detail: TopicDetail; title: string; selectedCommit: string; own: boolean; canEdit: boolean; archived: boolean; archiveBusy: boolean; loading: boolean }>()
defineEmits<{ history: []; share: []; references: []; refresh: []; rename: []; browse: []; latest: []; archive: [value: boolean] }>()
const router = useRouter()
</script>

<template>
  <header class="space-y-5">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink as-child><RouterLink to="/topics">Topics</RouterLink></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem class="min-w-0"><BreadcrumbPage class="truncate">{{ title }}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{{ title }}</h1>
        <p v-if="detail.snapshot.topic.description" class="max-w-2xl text-sm leading-relaxed text-muted-foreground">{{ detail.snapshot.topic.description }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <Button variant="outline" @click="$emit('history')"><History />History</Button>
        <Button variant="outline" @click="$emit('share')"><Share2 />Share</Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="More actions" title="More actions"><Ellipsis /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52">
            <DropdownMenuItem @select="$emit('references')"><Library />All references</DropdownMenuItem>
            <DropdownMenuItem @select="$emit('browse')"><Search />{{ selectedCommit ? 'Browse current papers' : 'Browse linked papers' }}</DropdownMenuItem>
            <DropdownMenuItem :disabled="loading" @select="$emit('refresh')"><RefreshCw />Refresh</DropdownMenuItem>
            <DropdownMenuItem v-if="detail.legacy_research_session_id" @select="router.push(`/research/${detail.legacy_research_session_id}`)"><ScrollText />Original research</DropdownMenuItem>
            <template v-if="(canEdit && !selectedCommit) || own">
              <DropdownMenuSeparator />
              <DropdownMenuItem v-if="canEdit && !selectedCommit" @select="$emit('rename')"><Pencil />Rename</DropdownMenuItem>
              <DropdownMenuItem v-if="own && !archived" :disabled="archiveBusy" @select="$emit('archive', true)"><Archive />Archive</DropdownMenuItem>
              <DropdownMenuItem v-if="own && archived" :disabled="archiveBusy" @select="$emit('archive', false)"><ArchiveRestore />Unarchive</DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
      <span class="text-foreground">{{ detail.owner_display_name }}</span>
      <Badge variant="secondary" class="capitalize">{{ detail.permission }}</Badge>
      <Badge v-if="archived" variant="outline">Archived</Badge>
      <span aria-hidden="true">·</span>
      <time :datetime="detail.updated_at" :title="new Date(detail.updated_at).toLocaleString()">Updated {{ relativeTime(detail.updated_at) }}</time>
      <span aria-hidden="true">·</span>
      <button type="button" class="hover:text-foreground hover:underline underline-offset-4" @click="$emit('references')">{{ detail.snapshot.list.papers.length }} references</button>
      <span aria-hidden="true">·</span>
      <span class="inline-flex items-center gap-1 font-mono" :title="detail.commit"><GitBranch class="size-3" />{{ detail.commit.slice(0, 7) }}</span>
    </div>

    <Alert v-if="archived">
      <Archive />
      <AlertTitle>Archived {{ new Date(detail.archived_at!).toLocaleDateString() }}</AlertTitle>
      <AlertDescription>This topic is read-only. It can be read, cloned and shared, but not changed{{ own ? ' until you unarchive it' : '' }}.</AlertDescription>
    </Alert>
    <Alert v-if="selectedCommit">
      <History />
      <AlertTitle>You are reading an earlier version</AlertTitle>
      <AlertDescription>Paper search uses the latest version. <button type="button" class="font-medium text-foreground underline underline-offset-3" @click="$emit('latest')">Return to latest</button></AlertDescription>
    </Alert>
  </header>
</template>
