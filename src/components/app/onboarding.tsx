import { Button } from '@meetingat10/design-system/react'
import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Destination } from '@/components/app/site-chrome'
import { tourSteps, type TourStep } from '@/components/app/tour-steps'
import type { Session } from '@/lib/api'
import { siteForPath } from '@/lib/sites'

import './onboarding.css'

// Guided tour (2026-11-25, replaces the first-run modal). A newly activated account sees it once, right after it replaces
// its temporary sign-in details on /first-login; "Replay walkthrough" in the account menu starts it again. It dims the page,
// outlines one control per step, opens that control's page, and falls back to a centered card when the control is hidden
// (a phone has no sidebar). Steps live in tour-steps.ts. The first-login page marks the person as pending; ending the tour
// clears the mark for good.

const pendingKey = 'accs.onboarding.pending'

/** Called when the person finishes first login, so the tour opens on the page they land on. */
export function markOnboardingPending(userId: string) {
  try {
    localStorage.setItem(pendingKey, userId)
  } catch {
    // Private mode: no tour, nothing else breaks.
  }
}

function isPending(userId: string) {
  try {
    return localStorage.getItem(pendingKey) === userId
  } catch {
    return false
  }
}

function clearPending() {
  try {
    localStorage.removeItem(pendingKey)
  } catch {
    // Nothing to clear.
  }
}

const replayEvent = 'accs:onboarding-replay'

/** Opens the tour again from its first step (the account menu's "Replay walkthrough"). */
export function replayOnboarding() {
  window.dispatchEvent(new Event(replayEvent))
}

type Box = { top: number; left: number; width: number; height: number }
const pad = 6
const gap = 14
const visible = (el: Element) => el.getClientRects().length > 0

/** The control a step points at: a sidebar link, else its site's row (folded sidebar), else the phone tab, else nothing. */
function findTarget(step: TourStep, destinations: Destination[]) {
  const selectors = step.target ? [step.target] : []
  if (step.nav) {
    const home = destinations.find(({ site }) => site.id === siteForPath(step.nav!))?.href
    selectors.push(`.shell-side [data-nav="${step.nav}"]`)
    if (home) selectors.push(`.shell-side [data-nav="${home}"]`, `.shell-tabs [data-nav="${home}"]`)
  }
  for (const selector of selectors) {
    const el = [...document.querySelectorAll(selector)].find(visible)
    if (el) return el
  }
}

export function Onboarding({ session, destinations }: { session: Session; destinations: Destination[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(() => isPending(session.user.id))
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box>()
  const [pos, setPos] = useState<{ top: number; left: number }>()
  const target = useRef<Element | undefined>(undefined)
  const card = useRef<HTMLDivElement>(null)
  const before = useRef<Element | null>(null)
  const steps = useMemo(() => tourSteps(session), [session])
  const step = steps[Math.min(index, steps.length - 1)]
  const last = index >= steps.length - 1

  useEffect(() => {
    const replay = () => {
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(replayEvent, replay)
    return () => window.removeEventListener(replayEvent, replay)
  }, [])

  const close = useCallback(() => {
    clearPending()
    setOpen(false)
    ;(before.current as HTMLElement | null)?.focus?.()
  }, [])
  const go = useCallback((to: number) => setIndex(Math.max(0, Math.min(to, steps.length - 1))), [steps.length])

  const measure = useCallback(() => {
    const rect = target.current?.getBoundingClientRect()
    setBox(rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 })
  }, [])

  // Open the step's page, wait up to 3 seconds for its control, outline it; no control means a centered card.
  useEffect(() => {
    if (!open) return
    target.current = undefined
    setBox(undefined)
    if (step.nav && router.state.location.pathname !== step.nav) router.history.push(step.nav)
    if (!step.nav && !step.target) return
    let tries = 0
    let timer: number
    const find = () => {
      const el = findTarget(step, destinations)
      if (el) {
        target.current = el
        el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        measure()
      } else if (++tries < 30) timer = window.setTimeout(find, 100)
    }
    find()
    return () => window.clearTimeout(timer)
  }, [open, step, destinations, router, measure])

  // Follow the control when the window or any scroller moves.
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  // The card sits beside the outlined control (right of the sidebar, else below, else above), always inside the window.
  useLayoutEffect(() => {
    const el = card.current
    if (!open || !el) return
    const { offsetWidth: w, offsetHeight: h } = el
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = (left: number) => Math.max(12, Math.min(left, vw - w - 12))
    const y = (top: number) => Math.max(12, Math.min(top, vh - h - 12))
    if (!box) setPos({ left: x((vw - w) / 2), top: y((vh - h) / 2) })
    else if (box.left < vw / 3 && box.left + box.width + gap + w + 12 <= vw) setPos({ left: box.left + box.width + gap, top: y(box.top) })
    else if (box.top + box.height + gap + h + 12 <= vh) setPos({ left: x(box.left), top: box.top + box.height + gap })
    else if (box.top - gap - h >= 12) setPos({ left: x(box.left), top: box.top - gap - h })
    else setPos({ left: x((vw - w) / 2), top: y((vh - h) / 2) })
  }, [open, box, step])

  // Focus moves into the card when the tour opens and returns to where it was when it ends.
  useEffect(() => {
    if (!open) return
    before.current = document.activeElement
    card.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowRight') last ? close() : go(index + 1)
      else if (event.key === 'ArrowLeft') go(index - 1)
      else if (event.key === 'Enter' && !el.closest?.('button, a')) last ? close() : go(index + 1)
      else if (event.key === 'Tab') {
        const items = [...(card.current?.querySelectorAll('button') ?? [])]
        const first = items[0]
        const end = items[items.length - 1]
        if (!card.current?.contains(el) || (event.shiftKey && (el === first || el === card.current)) || (!event.shiftKey && el === end)) {
          event.preventDefault()
          ;(event.shiftKey ? end : first)?.focus()
        }
        return
      } else return
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, index, last, close, go])

  if (!open) return null

  return createPortal(
    <div className="tour">
      <div className="tour-block" data-dim={!box || undefined} />
      {box && <div className="tour-spot" style={box} aria-hidden />}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-label={`Guided tour, step ${index + 1} of ${steps.length}`}
        tabIndex={-1}
        style={pos ?? { visibility: 'hidden' }}
      >
        <p className="tour-count">
          Step {index + 1} of {steps.length}
        </p>
        <div aria-live="polite" aria-atomic="true">
          <h2 className="tour-title">{step.title}</h2>
          <p className="tour-text">{step.text}</p>
        </div>
        <div className="tour-actions">
          {!last && (
            <Button variant="tertiary" size="sm" onPress={close}>
              Skip
            </Button>
          )}
          <span className="tour-actions__gap" />
          {index > 0 && (
            <Button variant="secondary" size="sm" onPress={() => go(index - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" onPress={() => (last ? close() : go(index + 1))}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
