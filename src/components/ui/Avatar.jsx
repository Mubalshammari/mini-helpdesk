const PALETTE = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
]

function initials(name) {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function colorFor(name) {
  let hash = 0
  for (let i = 0; i < (name?.length ?? 0); i++) hash = (hash + name.charCodeAt(i)) % PALETTE.length
  return PALETTE[hash]
}

export default function Avatar({ name, size = 32 }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${colorFor(name)}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}
