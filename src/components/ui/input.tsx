import { forwardRef, InputHTMLAttributes } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex h-9 w-full rounded-lg border border-stone-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
