import type { IdeaCategory } from '@paperland/shared'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'

export const IDEA_CATEGORIES: IdeaCategory[] = ['unreviewed', 'under-review', 'validating', 'archived']

export const IDEA_CATEGORY_LABELS: Record<IdeaCategory, string> = {
  'unreviewed': 'Unreviewed',
  'under-review': 'Under Review',
  'validating': 'Validating',
  'archived': 'Archived',
}

export const IDEA_CATEGORY_VARIANT: Record<IdeaCategory, BadgeVariant> = {
  'unreviewed': 'outline',
  'under-review': 'default',
  'validating': 'secondary',
  'archived': 'outline',
}
