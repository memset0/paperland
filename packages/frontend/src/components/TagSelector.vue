<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { X, Plus, Check } from '@lucide/vue'
import { useTagsStore } from '@/stores/tags'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [tags: string[]] }>()

const tagsStore = useTagsStore()
const open = ref(false)
const searchQuery = ref('')

onMounted(() => tagsStore.ensureLoaded())

const filteredTags = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return tagsStore.tags
  return tagsStore.tags.filter(t => t.name.toLowerCase().includes(q))
})

const canCreateNew = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return false
  return !tagsStore.tags.some(t => t.name.toLowerCase() === q.toLowerCase())
})

function toggleTag(name: string) {
  if (props.modelValue.includes(name)) {
    emit('update:modelValue', props.modelValue.filter(t => t !== name))
  } else {
    emit('update:modelValue', [...props.modelValue, name])
  }
}

function removeTag(name: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== name))
}

function createAndAdd() {
  const name = searchQuery.value.trim()
  if (name && !props.modelValue.includes(name)) {
    emit('update:modelValue', [...props.modelValue, name])
    searchQuery.value = ''
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <Label>标签</Label>
    <div class="flex flex-wrap gap-1">
      <Badge v-for="tag in modelValue" :key="tag" variant="secondary" class="gap-1 pr-1">
        {{ tag }}
        <button
          type="button"
          @click="removeTag(tag)"
          :aria-label="`移除 ${tag}`"
          class="hover:text-foreground"
        >
          <X class="size-3" />
        </button>
      </Badge>
      <Popover v-model:open="open">
        <PopoverTrigger as-child>
          <Button variant="outline" size="xs">
            <Plus class="size-3" />
            添加标签
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-64 p-0">
          <div class="p-2">
            <Input v-model="searchQuery" placeholder="搜索或创建标签..." />
          </div>
          <div class="max-h-48 overflow-y-auto border-t">
            <Button
              v-if="canCreateNew"
              variant="ghost"
              size="sm"
              class="w-full justify-start rounded-none text-primary"
              @click="createAndAdd"
            >
              <Plus class="size-3.5" />
              创建 "{{ searchQuery.trim() }}"
            </Button>
            <Button
              v-for="tag in filteredTags" :key="tag.id"
              variant="ghost"
              size="sm"
              class="w-full justify-start rounded-none"
              @click="toggleTag(tag.name)"
            >
              <Check :class="['size-3.5', modelValue.includes(tag.name) ? 'opacity-100' : 'opacity-0']" />
              <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: tag.color || 'var(--muted-foreground)' }" />
              <span class="flex-1 text-left">{{ tag.name }}</span>
              <span class="text-muted-foreground">{{ tag.paper_count }}</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  </div>
</template>
