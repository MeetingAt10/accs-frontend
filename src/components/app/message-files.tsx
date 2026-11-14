import { Button, Icon, toast } from '@meetingat10/design-system/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { apiErrorText, messageFileLink, messageFilePath, postFileLink, postFilePath, uploadMessageFile, type MessageFile } from '@/lib/api'
import './message-files.css'

// Files in Messages (MeetingAt10/accs-backend#90). Pictures show as thumbnails that open full size; other files are a
// chip that downloads. Links are short-lived and only members of the conversation get one.

/** What a message may carry: the same list the API accepts. */
export const messageFileExtensions: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
}
export const messageFileMaxBytes = 10 * 1024 * 1024
export const messageFilesPerMessage = 5
export const messageFileAccept = Object.keys(messageFileExtensions).join(',')

/** What is wrong with a chosen file, or an empty string. Short: it shows under the file's name. */
/**
 * The type to send for a file: the browser's, or, when the browser gives none (common for Office files), the one its
 * extension stands for. Undefined when the file is not an allowed type or its type and extension disagree.
 */
export function messageFileType(file: { name: string; type: string }) {
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  if (messageFileExtensions[file.type]?.includes(extension)) return file.type
  if (file.type && file.type !== 'application/octet-stream') return undefined
  return Object.entries(messageFileExtensions).find(([, extensions]) => extensions.includes(extension))?.[0]
}

export function messageFileProblem(file: { name: string; type: string; size: number }) {
  if (!messageFileType(file)) return 'Not a picture, PDF, Office or text file.'
  if (file.size > messageFileMaxBytes) return 'Larger than 10 MB.'
  if (file.size === 0) return 'This file is empty.'
  return ''
}

/** 1.2 MB, 340 KB. */
export function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const isPicture = (file: { contentType: string }) => file.contentType.startsWith('image/')

/** Where a set of files comes from: a message or a post. */
type FileSource = { key: string[]; path: (fileId: string) => string; link: (fileId: string) => Promise<string> }

function Picture({ source, file }: { source: FileSource; file: MessageFile }) {
  // Signed links last five minutes; ask again a little before that.
  const link = useQuery({
    queryKey: [...source.key, file.id],
    queryFn: () => source.link(file.id),
    staleTime: 240_000,
    refetchInterval: 240_000,
  })
  return (
    <a className="mf-picture" href={link.data ?? source.path(file.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.fileName} (opens in a new tab)`}>
      {link.data ? <img src={link.data} alt={file.fileName} loading="lazy" /> : <span className="mf-picture__wait" aria-hidden><Icon name="file" size={20} /></span>}
    </a>
  )
}

/** The files sent with one message. */
export function MessageFiles({ threadId, messageId, files }: { threadId: string; messageId: string; files: MessageFile[] }) {
  return <FileGallery files={files} source={{ key: ['message-file', threadId, messageId], path: (id) => messageFilePath(threadId, messageId, id), link: (id) => messageFileLink(threadId, messageId, id) }} />
}

/** The pictures and files posted with a post. */
export function PostFiles({ postId, files }: { postId: string; files: MessageFile[] }) {
  return <FileGallery files={files} source={{ key: ['post-file', postId], path: (id) => postFilePath(postId, id), link: (id) => postFileLink(postId, id) }} />
}

function FileGallery({ files, source }: { files: MessageFile[]; source: FileSource }) {
  if (!files.length) return null
  const pictures = files.filter(isPicture)
  const others = files.filter((file) => !isPicture(file))
  return (
    <div className="mf-files">
      {pictures.length > 0 && (
        <div className="mf-pictures" data-count={Math.min(pictures.length, 3)}>
          {pictures.map((file) => <Picture key={file.id} source={source} file={file} />)}
        </div>
      )}
      {others.map((file) => (
        <a key={file.id} className="mf-chip" href={source.path(file.id)} download={file.fileName}>
          <Icon name="file" size={20} />
          <span className="mf-chip__text"><strong>{file.fileName}</strong><small>{fileSize(file.size)}</small></span>
          <Icon name="download" size={16} />
        </a>
      ))}
    </div>
  )
}

/** A file chosen in the composer, while it uploads and once it is ready to send. */
export type PendingFile = { key: string; name: string; size: number; preview?: string; state: 'uploading' | 'ready' | 'failed'; file?: MessageFile; problem?: string }

/** The files waiting to go with the next message. */
export function PendingFiles({ files, onRemove }: { files: PendingFile[]; onRemove: (key: string) => void }) {
  if (!files.length) return null
  return (
    <ul className="mf-pending" aria-label="Files to send">
      {files.map((file) => (
        <li key={file.key} className="mf-pending__item" data-state={file.state}>
          {file.preview ? <img src={file.preview} alt="" /> : <span className="mf-pending__icon" aria-hidden><Icon name="file" size={16} /></span>}
          <span className="mf-chip__text">
            <strong>{file.name}</strong>
            <small>{file.state === 'uploading' ? 'Uploading…' : file.state === 'failed' ? file.problem || 'Not uploaded' : fileSize(file.size)}</small>
          </span>
          <button type="button" className="mf-pending__remove" aria-label={`Remove ${file.name}`} onClick={() => onRemove(file.key)}>
            <Icon name="x" size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Files chosen for a post or a message: each uploads as soon as it is chosen. `ready` are the ones to send; `busy` while
 * any is still uploading. Start from files already saved (editing a post) with `initial` or `reset`.
 */
export function useFileUploads(max: number, initial: MessageFile[] = []) {
  const saved = (list: MessageFile[]): PendingFile[] => list.map((file) => ({ key: file.id, name: file.fileName, size: file.size, state: 'ready', file }))
  const [files, setFiles] = useState<PendingFile[]>(() => saved(initial))
  const ready = files.filter((file) => file.state === 'ready' && file.file).map((file) => file.file!)
  const busy = files.some((file) => file.state === 'uploading')
  // Previews still open when the composer goes away are released, or each keeps its picture in memory.
  const latest = useRef(files)
  latest.current = files
  useEffect(() => () => { for (const file of latest.current) if (file.preview) URL.revokeObjectURL(file.preview) }, [])
  function add(chosen: File[]) {
    const room = max - files.length
    if (room <= 0) { toast(`Attach at most ${max} files.`); return }
    if (chosen.length > room) toast(`Only ${room} more ${room === 1 ? 'file fits' : 'files fit'}.`)
    for (const file of chosen.slice(0, room)) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const problem = messageFileProblem(file)
      const preview = !problem && file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      setFiles((current) => [...current, { key, name: file.name, size: file.size, preview, state: problem ? 'failed' : 'uploading', problem }])
      if (problem) continue
      uploadMessageFile(file, messageFileType(file))
        .then((uploaded) => setFiles((current) => current.map((item) => (item.key === key ? { ...item, state: 'ready', file: uploaded } : item))))
        .catch((error) => setFiles((current) => current.map((item) => (item.key === key ? { ...item, state: 'failed', problem: apiErrorText(error) } : item))))
    }
  }
  function remove(key: string) {
    setFiles((current) => {
      const gone = current.find((file) => file.key === key)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return current.filter((file) => file.key !== key)
    })
  }
  function reset(next: MessageFile[] = []) {
    for (const file of files) if (file.preview) URL.revokeObjectURL(file.preview)
    setFiles(saved(next))
  }
  return { files, ready, busy, add, remove, reset }
}

/** "Add pictures or files" with the chosen files under it. */
export function FilePicker({ uploads, label = 'Add pictures or files' }: { uploads: ReturnType<typeof useFileUploads>; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="mf-picker">
      <input
        ref={input}
        className="mf-input"
        type="file"
        multiple
        accept={messageFileAccept}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (chosen.length) uploads.add(chosen)
        }}
      />
      <div className="mf-picker__bar">
        <Button variant="secondary" icon="paperclip" onPress={() => input.current?.click()}>{label}</Button>
        <small>Pictures, PDF, Word, PowerPoint, Excel or text. Up to 10 MB each.</small>
      </div>
      <PendingFiles files={uploads.files} onRemove={uploads.remove} />
    </div>
  )
}
