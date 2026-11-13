import { Icon } from '@meetingat10/design-system/react'
import { useQuery } from '@tanstack/react-query'

import { messageFileLink, messageFilePath, type MessageFile } from '@/lib/api'
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
export function messageFileProblem(file: { name: string; type: string; size: number }) {
  const allowed = messageFileExtensions[file.type]
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  if (!allowed || !allowed.includes(extension)) return 'Not a picture, PDF, Office or text file.'
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

function Picture({ threadId, messageId, file }: { threadId: string; messageId: string; file: MessageFile }) {
  // Signed links last five minutes; ask again a little before that.
  const link = useQuery({
    queryKey: ['message-file', threadId, messageId, file.id],
    queryFn: () => messageFileLink(threadId, messageId, file.id),
    staleTime: 240_000,
    refetchInterval: 240_000,
  })
  return (
    <a className="mf-picture" href={link.data ?? messageFilePath(threadId, messageId, file.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.fileName} (opens in a new tab)`}>
      {link.data ? <img src={link.data} alt={file.fileName} loading="lazy" /> : <span className="mf-picture__wait" aria-hidden><Icon name="file" size={20} /></span>}
    </a>
  )
}

/** The files sent with one message. */
export function MessageFiles({ threadId, messageId, files }: { threadId: string; messageId: string; files: MessageFile[] }) {
  if (!files.length) return null
  const pictures = files.filter(isPicture)
  const others = files.filter((file) => !isPicture(file))
  return (
    <div className="mf-files">
      {pictures.length > 0 && (
        <div className="mf-pictures" data-count={Math.min(pictures.length, 3)}>
          {pictures.map((file) => <Picture key={file.id} threadId={threadId} messageId={messageId} file={file} />)}
        </div>
      )}
      {others.map((file) => (
        <a key={file.id} className="mf-chip" href={messageFilePath(threadId, messageId, file.id)} download={file.fileName}>
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
