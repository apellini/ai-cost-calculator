import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ children, variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 rounded cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-sm',
        variant === 'primary' && 'bg-[#4f7dff] text-white hover:bg-[#3d6de8] active:bg-[#2d5dd4]',
        variant === 'secondary' && 'bg-white text-[#0f1117] border border-black/12 hover:bg-[#f8f9fb] hover:border-black/18 shadow-sm',
        variant === 'ghost' && 'text-[#6b7380] hover:text-[#0f1117] hover:bg-black/5',
        variant === 'danger' && 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
        variant === 'outline' && 'border border-[#4f7dff]/50 text-[#4f7dff] hover:bg-[#4f7dff]/8',
        className,
      )}
    >
      {children}
    </button>
  )
}
