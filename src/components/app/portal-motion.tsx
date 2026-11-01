import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useId, type ReactNode } from 'react'

import './portal.css'

// Motion helpers shared by the Home, notifications, assistant, people, and settings pages.
export const ease = [0.16, 1, 0.3, 1] as const

/** Number that counts up to its value. Non-numeric values render as given. */
export function Counter({ value }: { value: unknown }) {
  const reduce = useReducedMotion()
  const target =
    typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : undefined
  const motionValue = useMotionValue(reduce ? (target ?? 0) : 0)
  const label = useTransform(motionValue, (v) => Math.round(v).toLocaleString('en-PH'))
  useEffect(() => {
    if (target === undefined) return
    if (reduce) {
      motionValue.set(target)
      return
    }
    const controls = animate(motionValue, target, { duration: 0.9, ease })
    return () => controls.stop()
  }, [target, reduce, motionValue])
  if (target === undefined) return <>{typeof value === 'string' || typeof value === 'number' ? String(value) : '—'}</>
  return <motion.span>{label}</motion.span>
}

export type PillOption<T extends string> = { id: T; label: ReactNode; count?: number }

/** Filter pills with an indicator that slides between options. */
export function SlidePills<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: PillOption<T>[]
  className?: string
}) {
  const group = useId()
  return (
    <LayoutGroup id={group}>
      <div className={['accs-pills', 'pt-pills', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
        {options.map((option) => {
          const active = option.id === value
          return (
            <button
              type="button"
              key={option.id}
              className="accs-pill pt-pill"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
            >
              {active && (
                <motion.span
                  layoutId="pt-pill-indicator"
                  className="pt-pill__indicator"
                  transition={{ duration: 0.36, ease }}
                />
              )}
              <span className="pt-pill__label">{option.label}</span>
              {option.count !== undefined && option.count > 0 && (
                <span className="accs-pill__count pt-pill__label">{option.count}</span>
              )}
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

/** Height-animated expand/collapse region. */
export function Collapse({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          style={{ overflow: 'hidden' }}
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.32, ease }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Cross-fade and slide when `id` changes (tab and role views). */
export function SwapView({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: reduce ? 0 : 0.24, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
