#!/usr/bin/env node
// Builds the sign-in mascot sprites in src/assets/sign-in/mascot from the landing site's mascot rig
// (accs-landing/scripts/mascot). Body motion on the sign-in page (breathing, leaning, swaying, nodding) is done with
// CSS transforms so it runs at the display's frame rate; the sprites only carry what CSS cannot do: the faces and
// poses (one sheet) and the arm wave (a 24 fps strip). Body motion is left out of every frame for that reason.
//
// Usage: node scripts/sign-in-mascot.mjs
//   ACCS_LANDING       path to the accs-landing checkout (default: ../../accs-landing from this repo, then ../../../)
//   PLAYWRIGHT_MODULE  Playwright's index.mjs (default: ~/.agents/mcp-deps)
// Needs ImageMagick (`magick`) for the WebP conversion.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const landing = process.env.ACCS_LANDING ?? [resolve(root, '../../accs-landing'), resolve(root, '../../../accs-landing')].find(existsSync)
if (!landing) throw new Error('Set ACCS_LANDING to the accs-landing checkout.')
const { loadMascot, sharedDefs, frame } = await import(pathToFileURL(join(landing, 'scripts/mascot/rig.mjs')).href)
const { EMOTIONS, POSES } = await import(pathToFileURL(join(landing, 'scripts/mascot/library.mjs')).href)
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? join(homedir(), '.agents/mcp-deps/node_modules/playwright/index.mjs')).href)

const out = join(root, 'src/assets/sign-in/mascot')
const COLUMNS = 6
// The lion is drawn up to ~500 CSS px wide, so it renders at 2x; the cub (up to ~270 px) at 1x.
const SCALE = { lion: 2, cub: 1 }

// Order matters: -mascot.tsx indexes this sheet by name in the same order.
const FACES = {
  ...EMOTIONS,
  ...POSES,
  'blink-half': { lidTop: 0.5 },
  'blink-closed': { lidTop: 0.97, eye: 'closed' },
  'look-left': { lookX: -1, lookY: -0.1 },
  'look-right': { lookX: 1, lookY: -0.1 },
  'look-left-half': { lookX: -0.5, lookY: -0.05 },
  'look-right-half': { lookX: 0.5, lookY: -0.05 },
}
const WAVE_FRAMES = 24
const wave = (t) => ({ ...POSES.wave, armL: 112 + 20 * Math.sin(t * Math.PI * 2), headTilt: -7 + 1.5 * Math.sin((t + 0.25) * Math.PI * 2) })

function sheetSvg(m, states, columns, uid) {
  const [vx, vy, vw, vh] = m.cfg.viewBox
  const rows = Math.ceil(states.length / columns)
  const cells = states.map((state, i) => {
    const x = (i % columns) * vw, y = Math.floor(i / columns) * vh
    return `<svg x="${x}" y="${y}" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}" overflow="hidden">${frame(m, state, `${m.name}-${uid}${i}`)}</svg>`
  })
  const s = m.cfg.scale1x
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${columns * vw * s}" height="${rows * vh * s}" viewBox="0 0 ${columns * vw} ${rows * vh}" fill="none">${sharedDefs(m)}${cells.join('')}</svg>`, width: columns * vw * s, height: rows * vh * s }
}

const tmp = mkdtempSync(join(tmpdir(), 'sign-in-mascot-'))
const browser = await chromium.launch()
try {
  for (const name of ['lion', 'cub']) {
    const m = loadMascot(name, join(landing, 'public/landing'))
    const page = await (await browser.newContext({ deviceScaleFactor: SCALE[name] })).newPage()
    const jobs = [
      ['faces', sheetSvg(m, Object.values(FACES), COLUMNS, 'face-')],
      ['wave', sheetSvg(m, Array.from({ length: WAVE_FRAMES }, (_, i) => wave(i / WAVE_FRAMES)), WAVE_FRAMES, 'wave-')],
    ]
    for (const [file, { svg, width, height }] of jobs) {
      await page.setViewportSize({ width: Math.ceil(width), height: Math.ceil(height) })
      await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`)
      const png = join(tmp, `${name}-${file}.png`)
      await page.screenshot({ path: png, omitBackground: true, clip: { x: 0, y: 0, width, height }, timeout: 120_000 })
      const webp = join(out, `${name}-${file}.webp`)
      execFileSync('magick', [png, '-quality', '88', '-define', 'webp:alpha-quality=90', '-define', 'webp:method=6', webp])
      console.log(`${webp}  ${Math.ceil(width * SCALE[name])}x${Math.ceil(height * SCALE[name])}`)
    }
  }
  console.log(`faces: ${Object.keys(FACES).join(', ')}`)
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}
