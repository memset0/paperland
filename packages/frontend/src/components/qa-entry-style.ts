import type { QAEntryBackgroundColor } from '@paperland/shared'

export function qaEntryBackgroundClass(color: QAEntryBackgroundColor | null): string {
  if (color === 'gray') return 'bg-gray-100/55 dark:bg-gray-900/35'
  if (color === 'brown') return 'bg-stone-100/70 dark:bg-stone-900/35'
  if (color === 'orange') return 'bg-orange-50/75 dark:bg-orange-950/25'
  if (color === 'yellow') return 'bg-yellow-50/75 dark:bg-yellow-950/20'
  if (color === 'green') return 'bg-green-50/70 dark:bg-green-950/25'
  if (color === 'blue') return 'bg-blue-50/70 dark:bg-blue-950/25'
  if (color === 'purple') return 'bg-purple-50/70 dark:bg-purple-950/25'
  if (color === 'pink') return 'bg-pink-50/70 dark:bg-pink-950/25'
  if (color === 'red') return 'bg-red-50/65 dark:bg-red-950/20'
  return ''
}
