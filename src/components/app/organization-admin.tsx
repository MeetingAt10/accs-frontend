// Organization accounts (decided 19 November 2026): the Secretary and the Dean create an organization with its account
// and a student President; the organization account adds members and names their positions, like VP for Information.
import {
  Alert,
  Button,
  ComboBox,
  IconButton,
  Modal,
  ModalActions,
  ModalBody,
  SelectOption,
  TextArea,
  TextField,
  toast,
} from '@meetingat10/design-system/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { CredentialsDialog, errorText, fieldErrors, type Issued } from '@/components/app/accounts'
import { createOrganization, performPageAction, type PageAction } from '@/lib/api'

export type StudentChoice = { id: string; name: string; section?: string; program?: string }

const choiceText = (student: StudentChoice) => [student.name, student.section ?? student.program].filter(Boolean).join(' · ')
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** "New organization" on the Organizations page, for the Secretary and the Dean. */
export function NewOrganization({ students }: { students: StudentChoice[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [issued, setIssued] = useState<Issued>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [presidentId, setPresidentId] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const reset = () => { setName(''); setDescription(''); setEmail(''); setPresidentId(''); setErrors({}) }
  const mutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async ({ record, message }) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(message, { tone: 'success' })
      setOpen(false)
      reset()
      setIssued({ name: record.account.name, email: record.account.email, credentials: record.credentials, invite: record.invite })
    },
    onError: (error) => setErrors(fieldErrors(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      name: name.trim().length >= 2 ? undefined : 'Enter the organization name.',
      email: isEmail(email.trim()) ? undefined : 'Enter the email the organization signs in with.',
      presidentId: presidentId ? undefined : 'Choose the President.',
    }
    setErrors(next)
    if (next.name || next.email || next.presidentId) return
    mutation.mutate({ name: name.trim(), description: description.trim(), email: email.trim(), presidentId })
  }

  return (
    <>
      <Button icon="plus" onPress={() => setOpen(true)}>New organization</Button>
      <Modal title="New organization" isOpen={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <p>ACCS creates the organization and an account for it with temporary sign-in details. The organization changes them the first time it signs in.</p>
            <TextField label="Organization name" value={name} onChange={setName} autoComplete="off" isInvalid={Boolean(errors.name)} errorMessage={errors.name} />
            <TextArea label="About the organization" value={description} onChange={setDescription} maxLength={500} />
            <TextField
              label="Organization email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="off"
              description="The organization signs in with this. The sign-in details are emailed here."
              isInvalid={Boolean(errors.email)}
              errorMessage={errors.email}
            />
            <ComboBox
              label="President or representative"
              placeholder="Type a student's name"
              selectedKey={presidentId || null}
              onSelectionChange={(key) => setPresidentId(key ? String(key) : '')}
              emptyMessage="No student with that name"
              isInvalid={Boolean(errors.presidentId)}
              errorMessage={errors.presidentId}
            >
              {students.map((student) => (
                <SelectOption key={student.id} id={student.id} textValue={choiceText(student)}>{choiceText(student)}</SelectOption>
              ))}
            </ComboBox>
            {mutation.error && !errors.name && !errors.email && !errors.presidentId && (
              <Alert tone="danger" title="The organization couldn't be created">{errorText(mutation.error)}</Alert>
            )}
          </ModalBody>
          <ModalActions>
            <Button variant="secondary" onPress={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Create organization</Button>
          </ModalActions>
        </form>
      </Modal>
      <CredentialsDialog issued={issued} onClose={() => setIssued(undefined)} />
    </>
  )
}

function useMemberAction(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: Omit<PageAction, 'recordId'>) => performPageAction('P10', { ...action, recordId: organizationId } as PageAction),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['page'] })
      toast(result.message, { tone: 'success' })
    },
  })
}

/** "Add member" on the organization's Members tab, for the organization account. */
export function AddMember({ organizationId, students }: { organizationId: string; students: StudentChoice[] }) {
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [position, setPosition] = useState('')
  const action = useMemberAction(organizationId)
  const close = () => { setOpen(false); setStudentId(''); setPosition(''); action.reset() }
  return (
    <>
      <Button icon="plus" size="sm" onPress={() => setOpen(true)}>Add member</Button>
      <Modal title="Add member" isOpen={open} onOpenChange={(next) => { if (!next) close() }}>
        <ModalBody>
          <ComboBox
            label="Student"
            placeholder="Type a student's name"
            selectedKey={studentId || null}
            onSelectionChange={(key) => setStudentId(key ? String(key) : '')}
            emptyMessage="No student with that name"
          >
            {students.map((student) => (
              <SelectOption key={student.id} id={student.id} textValue={choiceText(student)}>{choiceText(student)}</SelectOption>
            ))}
          </ComboBox>
          <TextField label="Position" description="Optional, like VP for Information. Left empty, they show as Member." value={position} onChange={setPosition} maxLength={60} />
          {action.error && <Alert tone="danger" title="The member couldn't be added">{errorText(action.error)}</Alert>}
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={close}>Cancel</Button>
          <Button
            isDisabled={!studentId}
            loading={action.isPending}
            onPress={() => action.mutate({ action: 'addOrganizationMember', payload: { studentId, ...(position.trim() ? { position: position.trim() } : {}) } }, { onSuccess: close })}
          >
            Add
          </Button>
        </ModalActions>
      </Modal>
    </>
  )
}

/** The position editor and Remove for one member, for the organization account. */
export function MemberControls({ organizationId, member }: { organizationId: string; member: { id: string; name: string; organizationRole?: string } }) {
  const current = member.organizationRole && member.organizationRole !== 'Member' ? member.organizationRole : ''
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(current)
  const action = useMemberAction(organizationId)
  const close = () => { setOpen(false); action.reset() }
  return (
    <span className="org-member-controls">
      <IconButton icon="pencil" label={`Change ${member.name}'s position`} onPress={() => { setPosition(current); setOpen(true) }} />
      <Modal title={`${member.name}'s position`} isOpen={open} onOpenChange={(next) => { if (!next) close() }}>
        <ModalBody>
          <TextField label="Position" description="Like President or VP for Information. Left empty, they show as Member." value={position} onChange={setPosition} maxLength={60} autoFocus />
          {action.error && <Alert tone="danger" title="The change couldn't be saved">{errorText(action.error)}</Alert>}
        </ModalBody>
        <ModalActions>
          <Button
            variant="destructive"
            loading={action.isPending && action.variables?.action === 'removeOrganizationMember'}
            onPress={() => action.mutate({ action: 'removeOrganizationMember', payload: { studentId: member.id } }, { onSuccess: close })}
          >
            Remove from organization
          </Button>
          <Button
            loading={action.isPending && action.variables?.action === 'setMemberPosition'}
            onPress={() => action.mutate({ action: 'setMemberPosition', payload: { memberId: member.id, position: position.trim() } }, { onSuccess: close })}
          >
            Save
          </Button>
        </ModalActions>
      </Modal>
    </span>
  )
}
