interface SidebarRowProps {
  icon: React.ReactNode
  label: string
  value: string
}

export function SidebarRow({ icon, label, value }: SidebarRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="ml-auto text-sm font-medium text-text-primary truncate max-w-[140px]">
        {value}
      </span>
    </div>
  )
}
