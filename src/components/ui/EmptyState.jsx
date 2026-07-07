export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 px-6 py-16 text-center dark:border-stone-700">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <Icon size={22} weight="regular" className="text-stone-400 dark:text-stone-500" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
