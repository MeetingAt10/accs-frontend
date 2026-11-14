import type { CSSProperties, ReactNode } from 'react'

import './photo.css'

// Profile photos (MeetingAt10/accs-frontend#62, MeetingAt10/accs-backend#85). A person's photo shows wherever their
// initials showed; initials stay the fallback. Anonymous authors never carry a photo.

export const photoTypes = ['image/jpeg', 'image/png', 'image/webp']
export const photoMaxBytes = 80_000
const side = 256

const initialsOf = (name: string) => name.replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'

/** A round avatar: the photo when there is one, otherwise the initials. */
export function PersonAvatar({ name, photo, size = 32, className = '' }: { name: string; photo?: unknown; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) } as CSSProperties
  const src = typeof photo === 'string' && photo.startsWith('data:image/') ? photo : ''
  return src
    ? <img className={`pp-avatar ${className}`} style={style} src={src} alt="" aria-hidden />
    : <span className={`pp-avatar pp-avatar--initials ${className}`} style={style} aria-hidden>{initialsOf(name)}</span>
}

/** What is wrong with a chosen file, or an empty string. */
export function photoFileProblem(file: { type: string; size: number }) {
  if (!photoTypes.includes(file.type)) return 'Use a JPEG, PNG or WebP image.'
  if (file.size > 15 * 1024 * 1024) return 'Use an image of at most 15 MB.'
  return ''
}

/** Crops the image to its centre square and resizes it to 256 x 256, as a JPEG data URL of at most 80 KB. */
export async function squarePhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const crop = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot prepare the image.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, side, side)
  context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side)
  bitmap.close?.()
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (Math.floor((url.length - url.indexOf(',') - 1) * 3 / 4) <= photoMaxBytes) return url
  }
  throw new Error('This image is too detailed to shrink. Try another one.')
}

/** The photo URL when it is a data URL image, otherwise an empty string. */
export const photoSrc = (photo: unknown) => typeof photo === 'string' && photo.startsWith('data:image/') ? photo : ''

/** Inside an existing avatar circle: the photo filling it, or the fallback (usually the initials). */
export function AvatarFill({ photo, fallback }: { photo?: unknown; fallback: ReactNode }) {
  const src = photoSrc(photo)
  return src ? <img className="pp-fill" src={src} alt="" /> : <>{fallback}</>
}
