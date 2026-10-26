import {
  Avatar,
  AppShell,
  Badge,
  Button,
  DoorPlate,
  MenuButton,
  MenuItem,
  MenuSeparator,
  NavItem,
  RoleBadge,
  Sidebar,
  SidebarNote,
  SidebarSection,
  TopBar,
  IconButton,
  Search,
} from '@meetingat10/design-system/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

import { signOut, type Role, type Session } from '@/lib/api'

type NavEntry = { label: string; href: string; pageId?: string; icon?: string }
type NavGroup = { label: string; entries: NavEntry[] }

const roleNavigation: Record<Role, NavGroup[]> = {
  student: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
      { label: 'My classes', href: '/spaces', pageId: 'P07', icon: 'graduation-cap' },
      { label: 'Organizations', href: '/organizations', pageId: 'P09', icon: 'flag' },
      { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
      { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
      { label: 'Consultations', href: '/consultations', pageId: 'P14', icon: 'chalkboard' },
    ] },
    { label: 'Support', entries: [
      { label: 'My reports', href: '/reports', pageId: 'P18', icon: 'file' },
      { label: 'Evaluations', href: '/evaluations', pageId: 'P26', icon: 'list-checks' },
      { label: 'My standing', href: '/standing', pageId: 'P36', icon: 'info' },
    ] },
  ],
  organization: [{ label: 'Workspace', entries: [
    { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
    { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
    { label: 'Our organization', href: '/organizations', pageId: 'P09', icon: 'flag' },
    { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
    { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
  ] }],
  professor: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
      { label: 'My classes', href: '/spaces', pageId: 'P07', icon: 'graduation-cap' },
      { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
      { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
      { label: 'Consultations', href: '/consultations', pageId: 'P14', icon: 'chalkboard' },
    ] },
    { label: 'Support', entries: [
      { label: 'Assigned reports', href: '/cases', pageId: 'P21', icon: 'tray' },
      { label: 'Evaluations', href: '/evaluations', pageId: 'P26', icon: 'list-checks' },
    ] },
  ],
  staff: [{ label: 'Workspace', entries: [
    { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
    { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
    { label: 'Organizations', href: '/organizations', pageId: 'P09', icon: 'flag' },
  ] }],
  chair: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
      { label: 'Program sections', href: '/spaces', pageId: 'P07', icon: 'graduation-cap' },
      { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
      { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
    ] },
    { label: 'Oversight', entries: [
      { label: 'Report queue', href: '/cases', pageId: 'P21', icon: 'tray' },
      { label: 'Similar reports', href: '/cases/clusters', pageId: 'P23', icon: 'copy' },
      { label: 'Analytics', href: '/analytics', pageId: 'P25' },
      { label: 'Evaluation results', href: '/evaluations/results', pageId: 'P28', icon: 'list-checks' },
      { label: 'Student records', href: '/records', pageId: 'P33', icon: 'archive' },
    ] },
  ],
  dean: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
      { label: 'Sections', href: '/spaces', pageId: 'P07', icon: 'graduation-cap' },
      { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
      { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
    ] },
    { label: 'Oversight', entries: [
      { label: 'Escalated reports', href: '/cases', pageId: 'P21', icon: 'tray' },
      { label: 'Analytics', href: '/analytics', pageId: 'P25' },
      { label: 'Student records', href: '/records', pageId: 'P33', icon: 'archive' },
    ] },
    { label: 'Evaluations', entries: [
      { label: 'Cycles', href: '/evaluations/cycles', pageId: 'P30', icon: 'notepad' },
      { label: 'Results', href: '/evaluations/results', pageId: 'P28', icon: 'list-checks' },
    ] },
  ],
  administrator: [
    { label: 'Administration', entries: [
      { label: 'Overview', href: '/admin', pageId: 'P45', icon: 'house' },
      { label: 'Moderation', href: '/admin/moderation', pageId: 'P49', icon: 'flag' },
      { label: 'Users and roles', href: '/admin/users', pageId: 'P46', icon: 'users' },
      { label: 'Permissions', href: '/admin/roles', pageId: 'P48', icon: 'lock' },
      { label: 'Restrictions', href: '/restrictions', pageId: 'P35', icon: 'prohibit' },
      { label: 'Audit trail', href: '/admin/audit', pageId: 'P51', icon: 'list' },
      { label: 'Monitoring', href: '/admin/monitoring', pageId: 'P52', icon: 'desktop' },
    ] },
    { label: 'Community', entries: [
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
    ] },
  ],
  guidance: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
      { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
      { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
    ] },
    { label: 'Cases', entries: [
      { label: 'Case Files', href: '/cases', pageId: 'P21', icon: 'tray' },
    ] },
    { label: 'Records', entries: [
      { label: 'Student records', href: '/records', pageId: 'P33', icon: 'archive' },
      { label: 'Restrictions', href: '/restrictions', pageId: 'P35', icon: 'prohibit' },
    ] },
  ],
  osas: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
      { label: 'Messages', href: '/messages', pageId: 'P11', icon: 'envelope' },
      { label: 'Calendar', href: '/calendar', pageId: 'P13', icon: 'calendar' },
    ] },
    { label: 'Cases', entries: [
      { label: 'OSAS cases', href: '/cases', pageId: 'P21', icon: 'tray' },
    ] },
    { label: 'Records', entries: [
      { label: 'Student records', href: '/records', pageId: 'P33', icon: 'archive' },
      { label: 'Restrictions', href: '/restrictions', pageId: 'P35', icon: 'prohibit' },
    ] },
  ],
  president: [
    { label: 'Workspace', entries: [
      { label: 'Home', href: '/home', pageId: 'P03', icon: 'house' },
      { label: 'Feed', href: '/feed', pageId: 'P04', icon: 'chats' },
    ] },
    { label: 'Cases', entries: [
      { label: 'Executive cases', href: '/cases', pageId: 'P21', icon: 'tray' },
    ] },
  ],
}

export const accountNavigation: NavGroup[] = [{
  label: 'Account',
  entries: [
    { label: 'Directory', href: '/directory', pageId: 'P37', icon: 'users' },
    { label: 'Help', href: '/help', pageId: 'P42', icon: 'question' },
    { label: 'Settings', href: '/settings', pageId: 'P43', icon: 'gear' },
  ],
}]

export function RoleNavigation({ session, path }: { session: Session; path: string }) {
  const groups = session.user.roles.flatMap((role) => roleNavigation[role] ?? [])
  const allowed = new Set(session.allowedPages)
  return (
    <>
      {groups.map((group, groupIndex) => {
        const entries = group.entries.filter((entry) => !entry.pageId || allowed.has(entry.pageId))
        if (!entries.length) return null
        return (
          <SidebarSection label={group.label} key={group.label + groupIndex}>
            {entries.map((entry) => (
              <NavItem
                key={entry.href + entry.label}
                href={entry.href}
                icon={entry.icon as never}
                isCurrent={path === entry.href || (entry.href !== '/home' && path.startsWith(entry.href + '/'))}
              >
                {entry.label}
              </NavItem>
            ))}
          </SidebarSection>
        )
      })}
      {accountNavigation.map((group) => (
        <SidebarSection label={group.label} key={group.label}>
          {group.entries.filter((entry) => allowed.has(entry.pageId!)).map((entry) => (
            <NavItem
              key={entry.href}
              href={entry.href}
              icon={entry.icon as never}
              isCurrent={path === entry.href || path.startsWith(entry.href + '/')}
            >
              {entry.label}
            </NavItem>
          ))}
        </SidebarSection>
      ))}
    </>
  )
}

export function RoleSidebar({ session, path }: { session: Session; path: string }) {
  return (
    <Sidebar
      label="ACCS"
      brand={<DoorPlate size="sm" code="ACCS" />}
      footer={
        <div className="app-sidebar-person">
          <Avatar name={session.user.name} size={32} />
          <div>
            <p>{session.user.name}</p>
            <RoleBadge>{session.user.roles.map((role) => role[0].toUpperCase() + role.slice(1)).join(' · ')}</RoleBadge>
          </div>
        </div>
      }
    >
      <RoleNavigation session={session} path={path} />
      <SidebarNote>Sample data. Access follows your assigned role and scope.</SidebarNote>
    </Sidebar>
  )
}

export function AppTopBar({ session, title }: { session: Session; title: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  return (
    <TopBar
      title={title}
      tools={
        <>
          <form
            className="app-topbar-search"
            onSubmit={(event) => {
              event.preventDefault()
              if (search.trim()) window.location.assign('/feed?q=' + encodeURIComponent(search.trim()))
            }}
          >
            <Search label="Search posts and spaces" placeholder="Search posts and spaces" size="sm" value={search} onChange={setSearch} />
          </form>
          <Button variant="tertiary" href="/assistant">Assistant</Button>
          <IconButton icon="bell" label="Notifications" onPress={() => router.history.push('/notifications')} />
          <MenuButton
            label={session.user.name}
            icon="user"
            iconOnly
            placement="bottom end"
            onAction={async (key) => {
              if (key === 'profile') router.history.push('/profile')
              if (key === 'settings') router.history.push('/settings')
              if (key === 'help') router.history.push('/help')
              if (key === 'sign-out') {
                await signOut().catch(() => undefined)
                queryClient.removeQueries()
                router.history.push('/sign-in')
              }
            }}
          >
            <MenuItem id="profile">Profile</MenuItem>
            <MenuItem id="settings">Settings</MenuItem>
            <MenuItem id="help">Help</MenuItem>
            <MenuSeparator />
            <MenuItem id="sign-out">Sign out</MenuItem>
          </MenuButton>
        </>
      }
    />
  )
}

export function AppChrome({ session, title, children }: { session: Session; title: string; children: React.ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const navigation = <RoleNavigation session={session} path={path} />
  const restricted = session.user.restrictions.length > 0 && session.user.roles.includes('student')
  return (
    <div className="app-chrome">
      {restricted && (
        <div className="app-restricted-banner">
          <Badge tone="warning" form="pending">Some features paused</Badge>
          <span>Posting, commenting, and anonymous reporting are paused for this account.</span>
          <a href="/standing">View account standing</a>
        </div>
      )}
      <AppShell
        contentId="main-content"
        density={session.user.roles.some((role) => ['administrator', 'chair', 'dean', 'guidance', 'osas', 'president'].includes(role)) ? 'compact' : 'comfortable'}
        sidebar={<RoleSidebar session={session} path={path} />}
        mobileBrand={<DoorPlate size="sm" code="ACCS" />}
        mobileNav={navigation}
        topBar={<AppTopBar session={session} title={title} />}
      >
        <div className="app-shell__content">{children}</div>
      </AppShell>
    </div>
  )
}
