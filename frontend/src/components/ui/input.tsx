import { cn } from '@/lib/utils'
import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm bg-white border border-black/12 rounded text-[#0f1117] placeholder-[#9099b0]',
        'focus:outline-none focus:border-[#4f7dff]/60 focus:ring-2 focus:ring-[#4f7dff]/10 transition-colors shadow-sm',
        className,
      )}
    />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm bg-white border border-black/12 rounded text-[#0f1117] placeholder-[#9099b0] resize-none',
        'focus:outline-none focus:border-[#4f7dff]/60 focus:ring-2 focus:ring-[#4f7dff]/10 transition-colors shadow-sm',
        className,
      )}
    />
  )
}
