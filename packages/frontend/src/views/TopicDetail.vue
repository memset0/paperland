<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, ChevronRight, PanelLeft } from '@lucide/vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useTopicDetail } from '@/composables/useTopicDetail'
import { useTopicReading } from '@/composables/useTopicReading'
import { topicIcon } from '@/lib/topic-icons'
import AppVersion from '@/components/AppVersion.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import TopicCitationCard from '@/components/topics/TopicCitationCard.vue'
import TopicFileNav from '@/components/topics/TopicFileNav.vue'
import TopicHeader from '@/components/topics/TopicHeader.vue'
import TopicHistorySheet from '@/components/topics/TopicHistorySheet.vue'
import TopicReferenceList from '@/components/topics/TopicReferenceList.vue'
import TopicReferencesSheet from '@/components/topics/TopicReferencesSheet.vue'
import TopicRenameDialog from '@/components/topics/TopicRenameDialog.vue'
import TopicShareSheet from '@/components/topics/TopicShareSheet.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'

const page = ref<HTMLElement | null>(null), citationCard = ref<InstanceType<typeof TopicCitationCard> | null>(null)
const t = useTopicDetail({ render: () => void reading.displayReading(), closeCitation: () => citationCard.value?.close() })
const reading = useTopicReading(t, page, citationCard)
const { detail, currentDocument, homePage } = t
const isQuestions = computed(() => !!currentDocument.value && (currentDocument.value.path.endsWith('questions.md') || currentDocument.value.path === 'pages/research-questions/index.md'))
const documentIcon = computed(() => topicIcon(currentDocument.value?.fonticon || (currentDocument.value?.path === homePage.value ? 'BookOpen' : 'FileText')))
usePageTitle(computed(() => currentDocument.value && currentDocument.value.path !== homePage.value ? `${currentDocument.value.title} · ${t.title.value}` : t.title.value))
</script>

<template>
  <div ref="page" class="h-full overflow-auto">
    <div class="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:py-8">
      <div v-if="t.loading.value && !detail" class="space-y-4" aria-busy="true">
        <Skeleton class="h-3 w-32" /><Skeleton class="h-8 w-2/3" /><Skeleton class="h-4 w-1/2" />
        <span class="sr-only">Loading topic…</span>
      </div>
      <Alert v-if="t.error.value" variant="destructive" class="mb-6">
        <AlertTitle>Could not load this topic</AlertTitle>
        <AlertDescription>{{ t.error.value }} <button type="button" class="font-medium underline underline-offset-3" @click="t.load()">Try again</button></AlertDescription>
      </Alert>

      <template v-if="detail">
        <TopicHeader
          :detail="detail" :title="t.title.value" :selected-commit="t.selectedCommit.value" :own="t.own.value" :can-edit="t.canEdit.value"
          :archived="t.archived.value" :archive-busy="t.archiveBusy.value" :loading="t.loading.value"
          @history="t.historyOpen.value = true" @share="t.shareOpen.value = true" @references="t.openAllReferences" @refresh="t.load()"
          @rename="t.renameOpen.value = true" @browse="t.browsePapers" @latest="t.viewVersion()" @archive="t.setArchived"
        />
        <Separator class="my-6 lg:my-8" />

        <Button variant="outline" class="mb-6 w-full justify-start lg:hidden" @click="t.filesOpen.value = true">
          <PanelLeft />
          <span class="min-w-0 truncate">{{ currentDocument?.title ?? 'Pages' }}</span>
          <ChevronRight class="ml-auto text-muted-foreground" />
        </Button>

        <div class="grid min-w-0 items-start gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside v-if="t.wide.value" class="sticky top-6 max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto pb-6" aria-label="Topic files">
            <TopicFileNav :documents="detail.documents" :navigation="detail.snapshot.navigation" :selected="t.selectedFile.value" :home="homePage" @select="t.selectFile" />
          </aside>

          <main data-reading-surface="document" class="min-w-0 max-w-[680px]" @click.capture="reading.onDocumentLink">
            <template v-if="currentDocument">
              <div class="mb-5 hidden min-w-0 items-center gap-2 text-xs text-muted-foreground lg:flex">
                <component :is="documentIcon" class="size-3.5 shrink-0" />
                <span :title="currentDocument.path" class="min-w-0 truncate">{{ currentDocument.title }}</span>
              </div>
              <section class="topic-document min-w-0">
                <MarkdownContent v-if="currentDocument.body.trim()" :key="currentDocument.path" :content="currentDocument.body" disable-highlights qa-answer allow-html />
                <div v-else class="flex flex-col items-center rounded-lg border border-dashed px-6 py-14 text-center">
                  <BookOpen class="mb-3 size-6 text-muted-foreground" />
                  <h2 class="text-sm font-medium">{{ isQuestions ? 'Research questions' : 'The report is ready to begin' }}</h2>
                  <p class="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    <template v-if="isQuestions">Keep the questions you want to investigate together, with links to each research page.</template>
                    <template v-else-if="t.canEdit.value">Connect an app on the <RouterLink to="/plugins" class="underline underline-offset-3 hover:text-foreground">Plugins</RouterLink> page to research this topic and push its first report.</template>
                    <template v-else>The report will appear here when a collaborator adds it.</template>
                  </p>
                </div>
              </section>

              <Collapsible v-model:open="t.referencesOpen.value" class="mt-10 border-t pt-3">
                <CollapsibleTrigger class="flex w-full items-center gap-2 rounded-md py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight :class="['size-4 transition-transform', t.referencesOpen.value && 'rotate-90']" />Page references
                  <span class="ml-auto text-xs tabular-nums">{{ t.pageReferences.value.length }}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div data-reading-surface="references" class="pt-3">
                    <TopicReferenceList :detail="detail" :entries="t.pageReferences.value" :busy="t.busy.value" :imported="t.imported.value" compact @import="t.importPaper" />
                    <p v-if="!t.pageReferences.value.length" class="py-4 text-sm text-muted-foreground">No references assigned to this page yet.</p>
                    <Button variant="link" class="mt-2 px-0" @click="t.openAllReferences">View all references</Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </template>
            <div v-else class="rounded-lg border border-dashed py-14 text-center">
              <h2 class="text-sm font-medium">Page unavailable in this version</h2>
              <Button variant="outline" class="mt-4" @click="t.selectFile(homePage)">Open report</Button>
            </div>
          </main>
        </div>
      </template>
      <AppVersion class="mt-16" />
    </div>

    <template v-if="detail">
      <Sheet v-model:open="t.filesOpen.value">
        <SheetContent side="left" class="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader><SheetTitle>Topic pages</SheetTitle><SheetDescription>Choose a document from the page tree.</SheetDescription></SheetHeader>
          <TopicFileNav class="px-4 pb-6" :documents="detail.documents" :navigation="detail.snapshot.navigation" :selected="t.selectedFile.value" :home="homePage" @select="t.selectFile" />
        </SheetContent>
      </Sheet>
      <TopicCitationCard
        ref="citationCard" :detail="detail" :host="page" :document-key="`${t.scope()}:${t.selectedFile.value}:${t.selectedCommit.value}:${detail.commit}`"
        :disabled="t.readerCovered.value" :busy="t.busy.value" :imported="t.imported.value" :errors="t.importErrors.value" @import="t.importPaper" @locate="reading.locateReference"
      />
      <TopicReferencesSheet v-model:open="t.allReferencesOpen.value" :detail="detail" :entries="t.allReferences.value" :busy="t.busy.value" :imported="t.imported.value" @import="t.importPaper" @link="reading.onDocumentLink" />
      <TopicHistorySheet v-model:open="t.historyOpen.value" :topic-id="detail.id" :current="detail.commit" :selected-commit="t.selectedCommit.value" @view="t.viewVersion" />
      <TopicShareSheet v-model:open="t.shareOpen.value" :detail="detail" :own="t.own.value" @access="detail.default_access = $event" />
      <TopicRenameDialog v-model:open="t.renameOpen.value" :detail="detail" :reload="() => t.load()" @renamed="(d) => { detail = d; void t.load(true) }" />
    </template>
  </div>
</template>

<style scoped>
.topic-document :deep(a.topic-citation) { display: inline-flex; align-items: center; padding: 0.06em 0.4em; margin-inline: 0.1em; border-radius: 0.35rem; background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent); font-size: 0.76em; font-weight: 600; line-height: 1.6; font-variant-numeric: tabular-nums; text-decoration: none; vertical-align: 0.07em; }
.topic-document :deep(a.topic-citation:hover) { background: color-mix(in oklch, var(--primary) 18%, transparent); }
</style>
