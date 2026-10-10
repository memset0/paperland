<script setup lang="ts">
import { CheckCircle2, Download, MonitorSmartphone } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/composables/usePwaInstall'

const { canInstall, installed, standalone, install } = usePwaInstall()
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <div class="flex items-center gap-2">
        <MonitorSmartphone class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-sm font-semibold">Install app</h3>
      </div>
      <Button v-if="canInstall" size="sm" @click="install"><Download />Install</Button>
    </div>
    <div class="px-5 py-4 text-sm">
      <p v-if="installed" class="flex items-center gap-2">
        <CheckCircle2 class="h-4 w-4 text-emerald-500" />
        {{ standalone ? 'Paperland is running as an installed app.' : 'Paperland is installed. Open it from your desktop, dock, or home screen.' }}
      </p>
      <p v-else-if="canInstall" class="text-muted-foreground">
        将 Paperland 安装为独立窗口的 App，可从桌面 / Dock / 主屏幕直接打开。
      </p>
      <div v-else class="space-y-1.5 text-muted-foreground">
        <p>当前浏览器没有提供一键安装，可手动安装：</p>
        <ul class="list-disc space-y-1 pl-5 text-xs">
          <li><span class="text-foreground">Chrome / Edge</span>：地址栏右侧的安装图标，或菜单 → “Cast, save and share” / “Apps” → Install Paperland</li>
          <li><span class="text-foreground">Safari (macOS)</span>：File → Add to Dock</li>
          <li><span class="text-foreground">Safari (iOS / iPadOS)</span>：分享按钮 → Add to Home Screen</li>
        </ul>
      </div>
    </div>
  </Card>
</template>
