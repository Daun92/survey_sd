import { forwardRef, TextareaHTMLAttributes } from 'react'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`flex min-h-[80px] w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
