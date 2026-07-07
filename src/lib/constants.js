export const CATEGORIES = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'network', label: 'Network' },
  { value: 'account', label: 'Account' },
  { value: 'access', label: 'Access' },
  { value: 'other', label: 'Other' },
]

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

export const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

export const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'it', label: 'IT Support' },
  { value: 'admin', label: 'Administrator' },
]

export const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))
