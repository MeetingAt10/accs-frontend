import { Alert, Button, Icon, Modal, ModalActions, ModalBody, Radio, RadioGroup, TextArea, TextField, toast } from '@meetingat10/design-system/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'

import { ApiError, completeMaterialUpload, performPageAction, sendMaterialFile, startMaterialUpload, type PageAction } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { Empty, Panel, StatusChip } from '@/components/app/page-shell'
import './materials.css'

// Subjects and class materials (MeetingAt10/accs-backend#73 and #77). A section space lists its subjects with their
// professors; each subject space holds materials, links or files, that the subject's professors manage and the section's
// students open. Files go straight to private storage through a short-lived signed address, then the API confirms them.

type Item = Record<string, unknown>
const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const items = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []
const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback

export const materialMaxBytes = 25 * 1024 * 1024
const fileTypes: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
}
const accept = Object.values(fileTypes).flat().map((extension) => '.' + extension).join(',')

/** The type the API expects for a file, from its name when the browser does not know it. Undefined when not allowed. */
export function materialType(file: { name: string; type: string }) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type && fileTypes[file.type]?.includes(extension)) return file.type
  return Object.entries(fileTypes).find(([, extensions]) => extensions.includes(extension))?.[0]
}

/** What is wrong with a file before it is sent, or an empty string. */
export function fileProblem(file: { name: string; type: string; size: number }) {
  if (!file.size) return 'The file is empty.'
  if (file.size > materialMaxBytes) return 'Use a file of at most 25 MB.'
  if (!materialType(file)) return 'Use a PDF, Word, PowerPoint, Excel, text, PNG or JPG file.'
  return ''
}

export const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'

function useMaterialAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction('P08', action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
}

const fieldError = (error: unknown, path: string) => error instanceof ApiError ? error.fields?.find((field) => field.path === path)?.message : undefined

/** Section space: its subjects, each with its professors and a link to the subject's materials. */
export function SubjectList({ subjects }: { subjects: Item[] }) {
  if (!subjects.length) return <Panel><Empty title="No subjects yet">Subjects show here once the section's classes are set up.</Empty></Panel>
  return (
    <Panel flush title="Subjects">
      <ul className="accs-rows">
        {subjects.map((subject) => {
          const materials = items(subject.materials)
          const professors = items(subject.professors).map((person) => text(person.name)).filter(Boolean).join(', ')
          return (
            <li key={text(subject.id)}>
              <a className="accs-row accs-row--link mt-row" href={'/spaces/' + encodeURIComponent(text(subject.id))}>
                <span className="mt-row__body">
                  <span className="mt-row__title">{text(subject.subject, text(subject.title))}</span>
                  <span className="mt-row__meta">{professors || 'No professor assigned'}</span>
                </span>
                <span className="mt-row__aside">{materials.length} {materials.length === 1 ? 'material' : 'materials'} <Icon name="caret-right" size={16} /></span>
              </a>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/** Subject space: its materials, and the professor's tools to add, edit and remove them. */
export function SubjectMaterials({ spaceId, materials, canManage }: { spaceId: string; materials: Item[]; canManage: boolean }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Item>()
  const [removing, setRemoving] = useState<Item>()
  const remove = useMaterialAction()
  return (
    <div className="accs-stack">
      <Panel
        flush
        title="Class materials"
        action={canManage ? <Button size="sm" icon="plus" onPress={() => setAdding(true)}>Add material</Button> : undefined}
      >
        {materials.length ? (
          <ul className="accs-rows">
            {materials.map((material) => {
              const file = material.kind === 'file'
              const pending = file && material.status !== 'ready'
              const href = file ? text(material.downloadUrl) : text(material.url)
              return (
                <li key={text(material.id)} className="accs-row mt-row">
                  <span className="mt-row__icon" aria-hidden><Icon name={file ? 'file' : 'link'} size={16} /></span>
                  <span className="mt-row__body">
                    <span className="mt-row__title">
                      {href && !pending ? <a href={href} target="_blank" rel="noopener noreferrer">{text(material.title)}</a> : text(material.title)}
                      {pending && <StatusChip tone="warn">Upload not finished</StatusChip>}
                    </span>
                    <span className="mt-row__meta">
                      {[file ? [text(material.fileName), material.size ? fileSize(Number(material.size)) : ''].filter(Boolean).join(' · ') : 'Link', text(object(material.author).name), formatDate(material.updatedAt ?? material.at)].filter(Boolean).join(' · ')}
                    </span>
                    {text(material.note) && <span className="mt-row__note">{text(material.note)}</span>}
                  </span>
                  {canManage && (
                    <span className="mt-row__actions">
                      <Button size="sm" variant="secondary" onPress={() => setEditing(material)}>Edit</Button>
                      <Button size="sm" variant="tertiary" onPress={() => { remove.reset(); setRemoving(material) }}>Remove</Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty title="No materials yet">{canManage ? 'Add a link or a file for your students.' : 'Your professor has not shared any materials yet.'}</Empty>
        )}
      </Panel>
      {canManage && <AddMaterial key={adding ? 'open' : 'closed'} spaceId={spaceId} isOpen={adding} onClose={() => setAdding(false)} />}
      {editing && <EditMaterial key={text(editing.id)} material={editing} onClose={() => setEditing(undefined)} />}
      <Modal role="alertdialog" title="Remove this material?" isOpen={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(undefined)}>
        <ModalBody>
          <p>{text(removing?.title)} will no longer be available to the section.</p>
          {remove.error && <Alert tone="danger" title="It was not removed">{remove.error.message}</Alert>}
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setRemoving(undefined)}>Cancel</Button>
          <Button variant="destructive" loading={remove.isPending} onPress={() => remove.mutate({ action: 'removeMaterial', recordId: text(removing?.id), payload: {} }, { onSuccess: () => setRemoving(undefined) })}>Remove</Button>
        </ModalActions>
      </Modal>
    </div>
  )
}

function AddMaterial({ spaceId, isOpen, onClose }: { spaceId: string; isOpen: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'link' | 'file'>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File>()
  const [problem, setProblem] = useState('')
  const queryClient = useQueryClient()
  const link = useMaterialAction()
  const upload = useMutation({
    mutationFn: async () => {
      const chosen = file as File
      const started = await startMaterialUpload({ spaceId, title: title.trim(), ...(note.trim() ? { note: note.trim() } : {}), fileName: chosen.name, contentType: materialType(chosen) as string, size: chosen.size })
      await sendMaterialFile(started.record.upload, chosen)
      return completeMaterialUpload(started.record.material.id)
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
  const error = kind === 'link' ? link.error : upload.error
  const pending = link.isPending || upload.isPending
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0]
    upload.reset()
    setFile(chosen)
    setProblem(chosen ? fileProblem(chosen) : '')
    if (chosen && !title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, ''))
  }
  const ready = Boolean(title.trim()) && (kind === 'link' ? Boolean(url.trim()) : Boolean(file) && !problem)
  const save = () => {
    if (!ready) return
    if (kind === 'link') link.mutate({ action: 'addMaterial', payload: { spaceId, title: title.trim(), url: url.trim(), ...(note.trim() ? { note: note.trim() } : {}) } }, { onSuccess: onClose })
    else upload.mutate(undefined, { onSuccess: onClose })
  }
  return (
    <Modal title="Add a class material" isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalBody>
        <div className="mt-form">
          <RadioGroup label="Type" row value={kind} onChange={(value) => setKind(value as 'link' | 'file')}>
            <Radio value="link">Link</Radio>
            <Radio value="file">File</Radio>
          </RadioGroup>
          {kind === 'file' && (
            <label className="mt-file">
              <span className="mt-file__label">File</span>
              <input type="file" accept={accept} onChange={choose} />
              <span className="mt-hint">PDF, Word, PowerPoint, Excel, text, PNG or JPG, up to 25 MB.{file && !problem ? ` ${file.name}, ${fileSize(file.size)}.` : ''}</span>
            </label>
          )}
          {problem && <Alert tone="danger" title="Choose another file">{problem}</Alert>}
          <TextField label="Title" isRequired maxLength={160} value={title} onChange={setTitle} isInvalid={Boolean(fieldError(error, 'title'))} errorMessage={fieldError(error, 'title')} />
          {kind === 'link' && <TextField label="Link" type="url" isRequired maxLength={2000} value={url} onChange={setUrl} description="Starts with http:// or https://." isInvalid={Boolean(fieldError(error, 'url'))} errorMessage={fieldError(error, 'url')} />}
          <TextArea label="Note" maxLength={1000} value={note} onChange={setNote} description="Optional. What students should do with it." />
          {error && !(error instanceof ApiError && error.fields?.some((field) => ['title', 'url'].includes(field.path))) && <Alert tone="danger" title="The material was not added">{error.message}</Alert>}
        </div>
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={onClose} isDisabled={pending}>Cancel</Button>
        <Button loading={pending} isDisabled={!ready} onPress={save}>{kind === 'file' ? 'Upload' : 'Add link'}</Button>
      </ModalActions>
    </Modal>
  )
}

function EditMaterial({ material, onClose }: { material: Item; onClose: () => void }) {
  const link = material.kind !== 'file'
  const [title, setTitle] = useState(text(material.title))
  const [url, setUrl] = useState(text(material.url))
  const [note, setNote] = useState(text(material.note))
  const action = useMaterialAction()
  const save = () => action.mutate({
    action: 'updateMaterial',
    recordId: text(material.id),
    payload: { title: title.trim(), ...(link ? { url: url.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) },
  }, { onSuccess: onClose })
  return (
    <Modal title="Edit material" isOpen onOpenChange={(open) => !open && onClose()}>
      <ModalBody>
        <div className="mt-form">
          <TextField label="Title" isRequired maxLength={160} value={title} onChange={setTitle} isInvalid={Boolean(fieldError(action.error, 'title'))} errorMessage={fieldError(action.error, 'title')} />
          {link
            ? <TextField label="Link" type="url" isRequired maxLength={2000} value={url} onChange={setUrl} isInvalid={Boolean(fieldError(action.error, 'url'))} errorMessage={fieldError(action.error, 'url')} />
            : <p className="mt-hint">The file stays the same. To replace it, remove this material and upload the new file.</p>}
          <TextArea label="Note" maxLength={1000} value={note} onChange={setNote} />
          {action.error && !(action.error instanceof ApiError && action.error.fields?.length) && <Alert tone="danger" title="The change was not saved">{action.error.message}</Alert>}
        </div>
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={onClose} isDisabled={action.isPending}>Cancel</Button>
        <Button loading={action.isPending} isDisabled={!title.trim() || (link && !url.trim())} onPress={save}>Save</Button>
      </ModalActions>
    </Modal>
  )
}
