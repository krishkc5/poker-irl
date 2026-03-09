import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export const PageContainer = ({ children }: { children: ReactNode }) => (
  <div className="page-shell min-h-dvh px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
    <div className="page-shell-inner mx-auto w-full max-w-[1400px]">{children}</div>
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
      'poker-noise rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,21,18,0.9),rgba(8,14,13,0.94))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5',
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
      'inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold tracking-[0.02em] transition disabled:cursor-not-allowed disabled:opacity-45',
      variant === 'primary' &&
        'border-emerald-300/30 bg-[linear-gradient(180deg,#5fe1aa,#2fb97a)] text-emerald-950 hover:brightness-105',
      variant === 'secondary' &&
        'border-white/10 bg-[linear-gradient(180deg,rgba(29,37,35,0.98),rgba(14,19,18,0.98))] text-slate-100 hover:bg-[linear-gradient(180deg,rgba(38,46,44,0.98),rgba(18,24,22,0.98))]',
      variant === 'danger' &&
        'border-rose-300/20 bg-[linear-gradient(180deg,#ef6b60,#cf4d45)] text-white hover:brightness-105',
      variant === 'ghost' && 'border-white/12 bg-transparent text-slate-100 hover:bg-white/8',
      className,
    )}
    {...props}
  />
)

export const TextInput = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300',
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
      'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
      tone === 'neutral' && 'border-white/10 bg-slate-700/40 text-slate-100',
      tone === 'success' && 'border-emerald-300/20 bg-emerald-300/12 text-emerald-100',
      tone === 'warning' && 'border-amber-300/20 bg-amber-300/12 text-amber-100',
      tone === 'danger' && 'border-rose-300/20 bg-rose-300/12 text-rose-100',
    )}
  >
    {children}
  </span>
)

export const ErrorBanner = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-rose-400/35 bg-rose-600/16 px-3 py-2 text-sm text-rose-100">
    {message}
  </div>
)

export const LoadingView = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-300">{label}</div>
)
