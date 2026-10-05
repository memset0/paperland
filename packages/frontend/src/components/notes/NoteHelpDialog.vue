<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

// Quick in-app help for the note system: how headings + leading blockquotes build the mind-map,
// and how to grab an image link from the PDF. Opened from the "?" control in the note function bar.
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Notes — quick help</DialogTitle>
        <DialogDescription>Two things worth knowing about the note system.</DialogDescription>
      </DialogHeader>

      <div class="space-y-5 text-sm max-h-[70vh] overflow-y-auto pr-1">
        <section class="space-y-2">
          <h4 class="font-semibold">1 · Build the mind-map from your note</h4>
          <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Markdown <b>headings</b> become mind-map nodes — a deeper heading nests one level below a shallower one, and the text under a heading is that node's content.</li>
            <li>Start a node's content with a <b>blockquote</b> (<code>&gt;</code>) to add a read-only <b>content node</b> to the map — plain text, an image, or a formula. Several blockquotes in a row become several content nodes, shown before the node's sub-headings.</li>
          </ul>
          <pre class="rounded bg-muted p-2 text-xs overflow-x-auto"><code># Overview
&gt; A caption shown as a content node
&gt; ![](https://…/figure.png)

## Method
Text under the Method node…</code></pre>
        </section>

        <section class="space-y-2">
          <h4 class="font-semibold">2 · Grab an image link from the PDF</h4>
          <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Open the <b>PDF</b> tab and click the <b>Crop</b> tool in its toolbar.</li>
            <li>Drag a rectangle over the region, then release: it is captured to an image, uploaded to the image host, and a Markdown image link is <b>copied to your clipboard</b>.</li>
            <li>Paste it into your note. The link also carries a <code>paperland://…?pdf=…</code> anchor, so clicking it later jumps back to that spot in the PDF.</li>
          </ul>
          <pre class="rounded bg-muted p-2 text-xs overflow-x-auto"><code>[![](https://…/crop.png)](paperland://paper/42?pdf=3&rx=…)</code></pre>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
