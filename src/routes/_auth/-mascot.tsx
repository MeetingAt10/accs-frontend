import { useReducedMotion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

// Sprites from scripts/sign-in-mascot.mjs (built from the landing site's mascot rig): a sheet of faces and poses and
// a 24 fps arm-wave strip per mascot; the lion at 2x, the cub at 1x. No frame carries body motion. Breathing,
// leaning, swaying and nodding are CSS transforms (login.css), so they run at the display's frame rate; the sprite
// only swaps the face, and eyes and lids move in jumps anyway.
const sprites = import.meta.glob<string>('../../assets/sign-in/mascot/*.webp', { eager: true, query: '?url', import: 'default' })
const sprite = (name: MascotName, file: 'faces' | 'wave') => sprites[`../../assets/sign-in/mascot/${name}-${file}.webp`]!

export type MascotName = 'lion' | 'cub'

// The faces sheet: 6 columns, in this order (FACES in scripts/sign-in-mascot.mjs).
const faces = [
  'neutral', 'happy', 'laughing', 'surprised', 'sad', 'thinking', 'sleepy', 'wink', 'love', 'proud', 'wave', 'point',
  'cheer', 'document', 'blink-half', 'blink-closed', 'look-left', 'look-right', 'look-left-half', 'look-right-half',
] as const
type Face = (typeof faces)[number]
const COLUMNS = 6
const ROWS = Math.ceil(faces.length / COLUMNS)
const WAVE = { frames: 24, fps: 24 }
const frame: Record<MascotName, { width: number; height: number }> = { lion: { width: 280, height: 275 }, cub: { width: 308, height: 322 } }

/**
 * What the mascots are reacting to. `idle` breathes, blinks, glances around and sways now and then; `hello` waves
 * once and then idles; the rest are poses tied to the sign-in form.
 */
export type Mood = 'idle' | 'hello' | 'typing' | 'peek' | 'shown' | 'busy' | 'error' | 'success' | 'forgot' | 'reset' | 'doze' | 'wake'

const moodFaces: Record<Exclude<Mood, 'idle' | 'hello'>, Record<MascotName, Face>> = {
  typing: { lion: 'point', cub: 'happy' },
  peek: { lion: 'sleepy', cub: 'sleepy' },
  shown: { lion: 'wink', cub: 'wink' },
  busy: { lion: 'thinking', cub: 'thinking' },
  error: { lion: 'sad', cub: 'sad' },
  success: { lion: 'cheer', cub: 'love' },
  forgot: { lion: 'thinking', cub: 'thinking' },
  reset: { lion: 'document', cub: 'document' },
  doze: { lion: 'sleepy', cub: 'sleepy' },
  wake: { lion: 'surprised', cub: 'surprised' },
}

// Loads each sprite once and remembers when it is ready, so a mascot never shows a half-loaded image.
const ready = new Set<string>()
const loading = new Map<string, Promise<void>>()
function preload(url: string) {
  if (!loading.has(url)) {
    const image = new Image()
    image.src = url
    loading.set(url, image.decode().then(() => void ready.add(url), () => undefined))
  }
  return loading.get(url)!
}

const random = (min: number, max: number) => min + Math.random() * (max - min)
type Side = 'left' | 'right'

/** One mascot. Decorative: hidden from assistive technology. */
export function MascotSprite({ name, mood, delay = 0, className }: { name: MascotName; mood: Mood; delay?: number; className?: string }) {
  const reduce = !!useReducedMotion()
  const [loaded, setLoaded] = useState(() => ready.has(sprite(name, 'faces')))
  const [waveReady, setWaveReady] = useState(() => ready.has(sprite(name, 'wave')))
  // The greeting: one wave once its strip has loaded, given up after 5 s (a slow connection idles instead).
  const [greet, setGreet] = useState(true)
  // Idle beats: a face from the sheet (blink, glance), a lean toward the glance, or a slow sway.
  const [beatFace, setBeatFace] = useState<Face | null>(null)
  const [lean, setLean] = useState<Side | null>(null)
  const [swaying, setSwaying] = useState(false)

  useEffect(() => {
    let live = true
    preload(sprite(name, 'faces')).then(() => live && setLoaded(true))
    preload(sprite(name, 'wave')).then(() => live && setWaveReady(ready.has(sprite(name, 'wave'))))
    const giveUp = setTimeout(() => live && setGreet(false), 5000)
    return () => {
      live = false
      clearTimeout(giveUp)
    }
  }, [name])

  const calm = mood === 'idle' || mood === 'hello'
  const waving = calm && greet && waveReady && !reduce
  const idle = calm && !waving
  useEffect(() => {
    if (!idle || reduce) return
    let live = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) => new Promise<void>((done) => void timers.push(setTimeout(done, ms)))
    const show = (face: Face | null) => live && setBeatFace(face)

    async function blink() {
      for (const [face, ms] of [['blink-half', 45], ['blink-closed', 85], ['blink-half', 55]] as const) {
        show(face)
        await wait(ms)
      }
      show(null)
    }
    async function glance(side: Side) {
      show(`look-${side}-half`)
      if (live) setLean(side)
      await wait(60)
      show(`look-${side}`)
      await wait(random(900, 1500))
    }
    async function lookAround() {
      const first: Side = Math.random() < 0.5 ? 'left' : 'right'
      await glance(first)
      if (Math.random() < 0.6) await glance(first === 'left' ? 'right' : 'left')
      show('neutral')
      if (live) setLean(null)
      await wait(400)
      if (Math.random() < 0.5) await blink()
      show(null)
    }
    async function sway() {
      if (live) setSwaying(true)
      await wait(4800)
      if (live) setSwaying(false)
    }

    ;(async () => {
      await wait(random(1200, 2500))
      while (live) {
        const roll = Math.random()
        if (roll < 0.5) {
          await blink()
          if (Math.random() < 0.2) {
            await wait(140)
            await blink()
          }
        } else if (roll < 0.82) await lookAround()
        else await sway()
        await wait(random(2200, 5200))
      }
    })()
    return () => {
      live = false
      timers.forEach(clearTimeout)
      setBeatFace(null)
      setLean(null)
      setSwaying(false)
    }
  }, [idle, reduce])

  const face: Face = calm ? (beatFace ?? 'neutral') : moodFaces[mood][name]
  const { width, height } = frame[name]
  let style: CSSProperties
  if (waving) {
    style = {
      backgroundImage: `url(${sprite(name, 'wave')})`,
      backgroundSize: `${WAVE.frames * 100}% 100%`,
      '--wave-frames': WAVE.frames,
      '--wave-duration': `${WAVE.frames / WAVE.fps}s`,
      '--wave-delay': `${delay}s`,
    } as CSSProperties
  } else {
    const index = faces.indexOf(face)
    style = {
      backgroundImage: loaded ? `url(${sprite(name, 'faces')})` : undefined,
      backgroundSize: `${COLUMNS * 100}% ${ROWS * 100}%`,
      backgroundPosition: `${((index % COLUMNS) / (COLUMNS - 1)) * 100}% ${(Math.floor(index / COLUMNS) / (ROWS - 1)) * 100}%`,
    }
  }

  return (
    <span
      aria-hidden
      className={className ? `mascot ${className}` : 'mascot'}
      data-mascot={name}
      data-mood={idle ? 'idle' : mood}
      data-pose={waving ? 'wave-loop' : face}
      data-lean={lean ?? undefined}
      data-sway={swaying || undefined}
    >
      <span className="mascot__breath">
        <span
          key={waving ? 'wave' : 'face'}
          className="mascot__face"
          data-waving={waving || undefined}
          style={{ aspectRatio: `${width} / ${height}`, ...style }}
          onAnimationEnd={() => waving && setGreet(false)}
        />
      </span>
    </span>
  )
}

type MascotApi = {
  mood: Mood
  /** A pose from the form's result (busy, error, success). `ms` clears it again; null clears it now. */
  signal: (mood: Mood | null, ms?: number) => void
  /** The baseline for the current view: forgot, reset, or null for the sign-in form. */
  setView: (mood: Mood | null) => void
  /** The pose for the focused field, or null when no field has focus. */
  setField: (mood: Mood | null) => void
}

const MascotContext = createContext<MascotApi>({ mood: 'idle', signal: () => {}, setView: () => {}, setField: () => {} })
export const useMascot = () => useContext(MascotContext)

const dozeAfter = 45_000

/** Holds the mascots' mood. Priority: form result, then focused field, then view, then hello/idle/doze. */
export function MascotProvider({ children }: { children: ReactNode }) {
  const [signalled, setSignalled] = useState<Mood | null>(null)
  const [field, setField] = useState<Mood | null>(null)
  const [view, setView] = useState<Mood | null>(null)
  const [rest, setRest] = useState<'hello' | 'idle' | 'doze' | 'wake'>('hello')
  const signalTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const signal = useCallback((mood: Mood | null, ms?: number) => {
    clearTimeout(signalTimer.current)
    setSignalled(mood)
    if (mood && ms) signalTimer.current = setTimeout(() => setSignalled(null), ms)
  }, [])
  useEffect(() => () => clearTimeout(signalTimer.current), [])

  // Wave on arrival, then idle. Doze after 45 s without input; the next input wakes them with a short surprise.
  useEffect(() => {
    let doze: ReturnType<typeof setTimeout>
    let wake: ReturnType<typeof setTimeout> | undefined
    const hello = setTimeout(() => setRest((r) => (r === 'hello' ? 'idle' : r)), 2600)
    const arm = () => {
      clearTimeout(doze)
      doze = setTimeout(() => setRest('doze'), dozeAfter)
    }
    const onInput = () => {
      setRest((r) => {
        if (r !== 'doze') return r
        wake = setTimeout(() => setRest('idle'), 800)
        return 'wake'
      })
      arm()
    }
    arm()
    const events = ['pointermove', 'pointerdown', 'keydown', 'focusin', 'wheel'] as const
    for (const event of events) window.addEventListener(event, onInput, { passive: true })
    return () => {
      clearTimeout(hello)
      clearTimeout(doze)
      clearTimeout(wake)
      for (const event of events) window.removeEventListener(event, onInput)
    }
  }, [])

  const mood = signalled ?? field ?? view ?? rest
  const api = useMemo(() => ({ mood, signal, setView, setField }), [mood, signal])
  return <MascotContext.Provider value={api}>{children}</MascotContext.Provider>
}

/** The pose for whatever has focus inside the form column: email/ID field, hidden or shown password, or nothing. */
export function fieldMood(element: Element | null): Mood | null {
  if (!(element instanceof HTMLElement)) return null
  const password = element.closest('.au-password')?.querySelector('input')
  if (password) return password.type === 'password' ? 'peek' : 'shown'
  if (element instanceof HTMLInputElement && element.type !== 'checkbox' && element.type !== 'radio') return 'typing'
  return null
}

/** Maps a mutation's status to the busy, error and (optionally) success poses. */
export function useMascotStatus(status: 'idle' | 'pending' | 'error' | 'success', { cheer = false } = {}) {
  const { signal } = useMascot()
  useEffect(() => {
    if (status === 'pending') signal('busy')
    else if (status === 'error') signal('error', 2500)
    else if (status === 'success' && cheer) signal('success')
    else signal(null)
  }, [status, cheer, signal])
  // Leaving the view (or the page) drops any pose it set.
  useEffect(() => () => signal(null), [signal])
}
