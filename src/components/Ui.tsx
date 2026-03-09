import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export const PageContainer = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-br from-felt-900 via-felt-800 to-emerald-900 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-6xl">{children}</div>
  </div>
)

export const Panel = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <section
    className={cn(
      'rounded-2xl border border-white/10 bg-emerald-950/45 p-4 shadow-table backdrop-blur sm:p-5',
      className,
    )}
  >
    {children}
  </section>
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export const Button = ({ variant = 'primary', className, ...props }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45',
      variant === 'primary' && 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300',
      variant === 'secondary' && 'bg-slate-700 text-slate-50 hover:bg-slate-600',
      variant === 'danger' && 'bg-rose-500 text-white hover:bg-rose-400',
      variant === 'ghost' && 'border border-white/20 bg-transparent text-slate-100 hover:bg-white/10',
      className,
    )}
    {...props}
  />
)

export const TextInput = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300',
      className,
    )}
    {...props}
  />
)

export const NumberInput = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <TextInput className={className} inputMode="numeric" {...props} />
)

export const Badge = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) => (
  <span
    className={cn(
      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
      tone === 'neutral' && 'bg-slate-600/60 text-slate-100',
      tone === 'success' && 'bg-emerald-300/20 text-emerald-100',
      tone === 'warning' && 'bg-amber-300/20 text-amber-100',
      tone === 'danger' && 'bg-rose-300/20 text-rose-100',
    )}
  >
    {children}
  </span>
)

export const ErrorBanner = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-rose-400/40 bg-rose-600/20 px-3 py-2 text-sm text-rose-100">
    {message}
  </div>
)

export const LoadingView = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-300">{label}</div>
)
