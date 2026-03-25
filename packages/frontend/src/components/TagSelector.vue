<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { X, Plus, ChevronDown } from 'lucide-vue-next'
import { useTagsStore } from '@/stores/tags'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [tags: string[]]
}>()

const tagsStore = useTagsStore()
const searchQuery = ref('')
const isOpen = ref(false)

onMounted(() => tagsStore.ensureLoaded())

const filteredTags = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return tagsStore.tags
  return tagsStore.tags.filter(t => t.name.toLowerCase().includes(q))
})

const canCreateNew = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return false
  return !tagsStore.tags.some(t => t.name.toLowerCase() === q.toLowerCase()) && !props.modelValue.includes(q)
})

function addTag(name: string) {
  if (!props.modelValue.includes(name)) {
    emit('update:modelValue', [...props.modelValue, name])
  }
  searchQuery.value = ''
}

function removeTag(name: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== name))
}

function createAndAdd() {
  const name = searchQuery.value.trim()
  if (name) addTag(name)
}
</script>

<template>
  <div class="relative">
    <label class="block text-xs font-medium text-gray-500 mb-1">标签</label>

    <!-- Selected tags -->
    <div class="flex flex-wrap gap-1 mb-1.5" v-if="modelValue.length > 0">
      <span
        v-for="tag in modelValue" :key="tag"
        class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/10"
      >
        {{ tag }}
        <button @click.stop="removeTag(tag)" class="ml-0.5 hover:text-indigo-900 transition">
          <X class="h-3 w-3" />
        </button>
      </span>
    </div>

    <!-- Input + dropdown -->
    <div class="relative">
      <input
        v-model="searchQuery"
        @focus="isOpen = true"
        @blur="setTimeout(() => isOpen = false, 200)"
        type="text"
        placeholder="搜索或创建标签..."
        class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
      />
      <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
    </div>

    <!-- Dropdown -->
    <div
      v-if="isOpen && (filteredTags.length > 0 || canCreateNew)"
      class="absolute z-50 mt-1 w-full rounded-lg bg-white border border-gray-200 shadow-lg max-h-48 overflow-y-auto"
    >
      <!-- Create new -->
      <button
        v-if="canCreateNew"
        @mousedown.prevent="createAndAdd"
        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition"
      >
        <Plus class="h-3.5 w-3.5" />
        创建 "{{ searchQuery.trim() }}"
      </button>

      <!-- Existing tags -->
      <button
        v-for="tag in filteredTags" :key="tag.id"
        @mousedown.prevent="addTag(tag.name)"
        :class="[
          'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition',
          modelValue.includes(tag.name) ? 'bg-gray-50 text-gray-400 cursor-default' : 'hover:bg-gray-50 text-gray-700',
        ]"
        :disabled="modelValue.includes(tag.name)"
      >
        <span class="h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: tag.color || '#6b7280' }"></span>
        {{ tag.name }}
        <span class="ml-auto text-xs text-gray-400">{{ tag.paper_count }}</span>
      </button>
    </div>
  </div>
</template>
