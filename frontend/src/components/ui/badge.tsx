import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'economy' | 'balanced' | 'premium' | 'warning' | 'danger' | 'muted' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium font-mono whitespace-nowrap',
      variant === 'default' && 'bg-black/6 text-[#0f1117]',
      variant === 'economy' && 'bg-green-500/12 text-green-700 border border-green-500/25',
      variant === 'balanced' && 'bg-blue-500/10 text-blue-700 border border-blue-500/25',
      variant === 'premium' && 'bg-purple-500/10 text-purple-700 border border-purple-500/25',
      variant === 'warning' && 'bg-amber-500/12 text-amber-700 border border-amber-500/25',
      variant === 'danger' && 'bg-red-500/10 text-red-700 border border-red-500/25',
      variant === 'muted' && 'bg-black/5 text-[#6b7380]',
      variant === 'outline' && 'border border-black/14 text-[#6b7380]',
      className,
    )}>
      {children}
    </span>
  )
}
