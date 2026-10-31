import {
  Avatar,
  AppShell,
  Badge,
  Button,
  DoorPlate,
  Drawer,
  Link,
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
  Popover,
  Search,
  Stack,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  AssistantPanel,
  notificationHref,
} from "@/components/app/communications";
import { NotificationItem, NotificationList } from "@/components/ds-next";
import {
  ApiError,
  performPageAction,
  signOut,
  type Role,
  type Session,
} from "@/lib/api";
import { pageQuery } from "@/lib/queries";

type NavEntry = { label: string; href: string; pageId?: string; icon?: string };
type NavGroup = { label: string; entries: NavEntry[] };
type AppArea = "home" | "community" | "schedule" | "workspace";

const areaLabels: Record<AppArea, string> = {
  home: "Home",
  community: "Community",
  schedule: "Schedule",
  workspace: "Workspace",
};

const areaOrder: AppArea[] = ["home", "community", "schedule", "workspace"];

function areaForHref(href: string): AppArea {
  if (href === "/home" || href === "/admin") return "home";
  if (
    ["/feed", "/spaces", "/organizations", "/messages", "/directory"].some(
      (prefix) => href === prefix || href.startsWith(prefix + "/"),
    )
  ) {
    return "community";
  }
  if (
    ["/calendar", "/consultations"].some(
      (prefix) => href === prefix || href.startsWith(prefix + "/"),
    )
  ) {
    return "schedule";
  }
  return "workspace";
}

function areaForPath(path: string): AppArea {
  return areaForHref(path);
}

function navigationGroups(session: Session) {
  return [
    ...session.user.roles.flatMap((role) => roleNavigation[role] ?? []),
    ...accountNavigation,
  ];
}

function visibleEntries(session: Session, area?: AppArea) {
  const allowed = new Set(session.allowedPages);
  return navigationGroups(session).flatMap((group) =>
    group.entries.filter(
      (entry) =>
        (!entry.pageId || allowed.has(entry.pageId)) &&
        (!area || areaForHref(entry.href) === area),
    ),
  );
}

function hasSidebarEntries(session: Session, area: AppArea) {
  return visibleEntries(session, area).some(
    (entry) => !(area === "home" && entry.href === "/home"),
  );
}

function areaDestinations(session: Session) {
  return areaOrder.flatMap((area) => {
    const entries = visibleEntries(session, area);
    const preferred =
      area === "home"
        ? ["/home", "/admin"]
        : area === "community"
          ? ["/feed"]
          : area === "schedule"
            ? ["/calendar", "/consultations"]
            : [];
    const entry =
      preferred.map((href) => entries.find((item) => item.href === href)).find(Boolean) ??
      entries[0];
    return entry ? [{ area, href: entry.href }] : [];
  });
}

function AreaLinks({ session, path }: { session: Session; path: string }) {
  const activeArea = areaForPath(path);
  const icons: Record<AppArea, string> = {
    home: "house",
    community: "chats",
    schedule: "calendar",
    workspace: "notepad",
  };
  return (
    <>
      {areaDestinations(session).map(({ area, href }) => (
        <NavItem
          key={area}
          className="app-area-nav__item"
          href={href}
          icon={icons[area] as never}
          isCurrent={activeArea === area}
        >
          {areaLabels[area]}
        </NavItem>
      ))}
    </>
  );
}

function AppAreaNavigation({ session, path }: { session: Session; path: string }) {
  return (
    <nav className="app-area-nav" aria-label="Main destinations">
      <AreaLinks session={session} path={path} />
    </nav>
  );
}

const roleNavigation: Record<Role, NavGroup[]> = {
  student: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "My classes",
          href: "/spaces",
          pageId: "P07",
          icon: "graduation-cap",
        },
        {
          label: "Organizations",
          href: "/organizations",
          pageId: "P09",
          icon: "flag",
        },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
        {
          label: "Consultations",
          href: "/consultations",
          pageId: "P14",
          icon: "chalkboard",
        },
      ],
    },
    {
      label: "Support",
      entries: [
        { label: "My reports", href: "/reports", pageId: "P18", icon: "file" },
        {
          label: "Evaluations",
          href: "/evaluations",
          pageId: "P26",
          icon: "list-checks",
        },
        {
          label: "My standing",
          href: "/standing",
          pageId: "P36",
          icon: "info",
        },
      ],
    },
  ],
  organization: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "Our organization",
          href: "/organizations",
          pageId: "P09",
          icon: "flag",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
      ],
    },
  ],
  professor: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "My classes",
          href: "/spaces",
          pageId: "P07",
          icon: "graduation-cap",
        },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
        {
          label: "Consultations",
          href: "/consultations",
          pageId: "P14",
          icon: "chalkboard",
        },
      ],
    },
    {
      label: "Support",
      entries: [
        {
          label: "Assigned reports",
          href: "/cases",
          pageId: "P21",
          icon: "tray",
        },
        {
          label: "Evaluations",
          href: "/evaluations",
          pageId: "P26",
          icon: "list-checks",
        },
      ],
    },
  ],
  staff: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "Organizations",
          href: "/organizations",
          pageId: "P09",
          icon: "flag",
        },
      ],
    },
  ],
  chair: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "Program sections",
          href: "/spaces",
          pageId: "P07",
          icon: "graduation-cap",
        },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
      ],
    },
    {
      label: "Oversight",
      entries: [
        { label: "Report queue", href: "/cases", pageId: "P21", icon: "tray" },
        {
          label: "Similar reports",
          href: "/cases/clusters",
          pageId: "P23",
          icon: "copy",
        },
        { label: "Analytics", href: "/analytics", pageId: "P25" },
        {
          label: "Evaluation results",
          href: "/evaluations/results",
          pageId: "P28",
          icon: "list-checks",
        },
        {
          label: "Student records",
          href: "/records",
          pageId: "P33",
          icon: "archive",
        },
      ],
    },
  ],
  dean: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "Sections",
          href: "/spaces",
          pageId: "P07",
          icon: "graduation-cap",
        },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
      ],
    },
    {
      label: "Oversight",
      entries: [
        {
          label: "Escalated reports",
          href: "/cases",
          pageId: "P21",
          icon: "tray",
        },
        { label: "Analytics", href: "/analytics", pageId: "P25" },
        {
          label: "Student records",
          href: "/records",
          pageId: "P33",
          icon: "archive",
        },
      ],
    },
    {
      label: "Evaluations",
      entries: [
        {
          label: "Cycles",
          href: "/evaluations/cycles",
          pageId: "P30",
          icon: "notepad",
        },
        {
          label: "Results",
          href: "/evaluations/results",
          pageId: "P28",
          icon: "list-checks",
        },
      ],
    },
  ],
  administrator: [
    {
      label: "Administration",
      entries: [
        { label: "Overview", href: "/admin", pageId: "P45", icon: "house" },
        {
          label: "Moderation",
          href: "/admin/moderation",
          pageId: "P49",
          icon: "flag",
        },
        {
          label: "Users and roles",
          href: "/admin/users",
          pageId: "P46",
          icon: "users",
        },
        {
          label: "Permissions",
          href: "/admin/roles",
          pageId: "P48",
          icon: "lock",
        },
        {
          label: "Restrictions",
          href: "/restrictions",
          pageId: "P35",
          icon: "prohibit",
        },
        {
          label: "Audit trail",
          href: "/admin/audit",
          pageId: "P51",
          icon: "list",
        },
        {
          label: "Monitoring",
          href: "/admin/monitoring",
          pageId: "P52",
          icon: "desktop",
        },
      ],
    },
    {
      label: "Community",
      entries: [{ label: "Feed", href: "/feed", pageId: "P04", icon: "chats" }],
    },
  ],
  guidance: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
      ],
    },
    {
      label: "Cases",
      entries: [
        { label: "Case Files", href: "/cases", pageId: "P21", icon: "tray" },
      ],
    },
    {
      label: "Records",
      entries: [
        {
          label: "Student records",
          href: "/records",
          pageId: "P33",
          icon: "archive",
        },
        {
          label: "Restrictions",
          href: "/restrictions",
          pageId: "P35",
          icon: "prohibit",
        },
      ],
    },
  ],
  osas: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
        {
          label: "Messages",
          href: "/messages",
          pageId: "P11",
          icon: "envelope",
        },
        {
          label: "Calendar",
          href: "/calendar",
          pageId: "P13",
          icon: "calendar",
        },
      ],
    },
    {
      label: "Cases",
      entries: [
        { label: "OSAS cases", href: "/cases", pageId: "P21", icon: "tray" },
      ],
    },
    {
      label: "Records",
      entries: [
        {
          label: "Student records",
          href: "/records",
          pageId: "P33",
          icon: "archive",
        },
        {
          label: "Restrictions",
          href: "/restrictions",
          pageId: "P35",
          icon: "prohibit",
        },
      ],
    },
  ],
  president: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Feed", href: "/feed", pageId: "P04", icon: "chats" },
      ],
    },
    {
      label: "Cases",
      entries: [
        {
          label: "Executive cases",
          href: "/cases",
          pageId: "P21",
          icon: "tray",
        },
      ],
    },
  ],
};

export const accountNavigation: NavGroup[] = [
  {
    label: "Account",
    entries: [
      { label: "Directory", href: "/directory", pageId: "P37", icon: "users" },
      { label: "Help", href: "/help", pageId: "P42", icon: "question" },
      { label: "Settings", href: "/settings", pageId: "P43", icon: "gear" },
    ],
  },
];

export function RoleNavigation({
  session,
  path,
  area,
}: {
  session: Session;
  path: string;
  area: AppArea;
}) {
  const groups = navigationGroups(session);
  const allowed = new Set(session.allowedPages);
  return (
    <>
      {groups.map((group, groupIndex) => {
        const entries = group.entries.filter(
          (entry) =>
            (!entry.pageId || allowed.has(entry.pageId)) &&
            areaForHref(entry.href) === area &&
            !(area === "home" && entry.href === "/home"),
        );
        if (!entries.length) return null;
        const label =
          group.label === "Workspace" ||
          (group.label === "Account" && area === "community")
            ? areaLabels[area]
            : group.label;
        return (
          <SidebarSection label={label} key={group.label + groupIndex}>
            {entries.map((entry) => (
              <NavItem
                key={entry.href + entry.label}
                href={entry.href}
                icon={entry.icon as never}
                isCurrent={
                  path === entry.href ||
                  (entry.href !== "/home" && path.startsWith(entry.href + "/"))
                }
              >
                {entry.label}
              </NavItem>
            ))}
          </SidebarSection>
        );
      })}
    </>
  );
}

export function RoleSidebar({
  session,
  path,
  area,
}: {
  session: Session;
  path: string;
  area: AppArea;
}) {
  return (
    <Sidebar
      label="ACCS"
      brand={<DoorPlate size="sm" code="ACCS" />}
      footer={
        <div className="app-sidebar-person">
          <Avatar name={session.user.name} size={32} />
          <div>
            <p>{session.user.name}</p>
            <RoleBadge>
              {session.user.roles
                .map((role) => role[0].toUpperCase() + role.slice(1))
                .join(" · ")}
            </RoleBadge>
          </div>
        </div>
      }
    >
      <RoleNavigation session={session} path={path} area={area} />
      <SidebarNote>
        Sample data. Access follows your assigned role and scope.
      </SidebarNote>
    </Sidebar>
  );
}

export function AppTopBar({
  session,
  title,
}: {
  session: Session;
  title: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const notifications = useQuery(pageQuery("P40"));
  const notificationAction = useMutation({
    mutationFn: (action: {
      action: "markNotification";
      recordId: string;
      payload: { read: boolean };
    }) => performPageAction("P40", action),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["page", "P40"] }),
  });

  async function openNotification(notification: Record<string, unknown>) {
    try {
      const result = await performPageAction("P40", {
        action: "openNotification",
        recordId: String(notification.id ?? ""),
        payload: {},
      });
      const source =
        result.record && typeof result.record === "object"
          ? (result.record as Record<string, unknown>)
          : {};
      router.history.push(
        notificationHref(
          String(source.pageId ?? ""),
          String(source.recordId ?? ""),
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && [403, 404].includes(error.status)) {
        router.history.push("/notifications");
      }
    }
  }

  const notificationItems = notifications.data?.data.notifications;
  const recentNotifications = Array.isArray(notificationItems)
    ? (notificationItems.slice(0, 5) as Record<string, unknown>[])
    : [];
  const unreadCount = recentNotifications.filter(
    (notice) => notice.read !== true,
  ).length;

  return (
    <>
      <TopBar
        title={title}
        tools={
          <>
            <form
              className="app-topbar-search"
              onSubmit={(event) => {
                event.preventDefault();
                if (search.trim())
                  window.location.assign(
                    "/feed?q=" + encodeURIComponent(search.trim()),
                  );
              }}
            >
              <Search
                label="Search posts and spaces"
                placeholder="Search posts and spaces"
                size="sm"
                value={search}
                onChange={setSearch}
              />
            </form>
            <Button variant="tertiary" onPress={() => setAssistantOpen(true)}>
              Assistant
            </Button>
            <Popover
              trigger={
                <IconButton
                  icon="bell"
                  label={
                    unreadCount
                      ? `Notifications, ${unreadCount} unread`
                      : "Notifications"
                  }
                />
              }
              title="Notifications"
              placement="bottom end"
            >
              {recentNotifications.length ? (
                <Stack gap={12}>
                  <NotificationList>
                    {recentNotifications.map((notification) => (
                      <NotificationItem
                        key={String(notification.id)}
                        notification={notification}
                        onOpen={() => void openNotification(notification)}
                        onRead={() =>
                          notificationAction.mutate({
                            action: "markNotification",
                            recordId: String(notification.id),
                            payload: { read: notification.read !== true },
                          })
                        }
                        isPending={notificationAction.isPending}
                      />
                    ))}
                  </NotificationList>
                  <Link href="/notifications">View all notifications</Link>
                </Stack>
              ) : (
                <Stack gap={12}>
                  <p>No new notifications.</p>
                  <Link href="/notifications">Open notifications</Link>
                </Stack>
              )}
            </Popover>
            <MenuButton
              label={session.user.name}
              icon="user"
              iconOnly
              placement="bottom end"
              onAction={async (key) => {
                if (key === "profile") router.history.push("/profile");
                if (key === "settings") router.history.push("/settings");
                if (key === "help") router.history.push("/help");
                if (key === "sign-out") {
                  await signOut().catch(() => undefined);
                  queryClient.removeQueries();
                  router.history.push("/sign-in");
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
      <Drawer
        title="Assistant"
        side="end"
        isOpen={assistantOpen}
        onOpenChange={setAssistantOpen}
      >
        <Stack gap={16}>
          <AssistantPanel />
          <Link href="/assistant">Open the full assistant page</Link>
        </Stack>
      </Drawer>
    </>
  );
}

function MobileAccountMenu({ session }: { session: Session }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = new Set(session.allowedPages);
  const canViewNotifications = allowed.has("P40");
  const notifications = useQuery({
    ...pageQuery("P40"),
    enabled: canViewNotifications,
  });
  const notificationItems = notifications.data?.data.notifications;
  const unreadCount = Array.isArray(notificationItems)
    ? notificationItems.filter(
        (notice) => (notice as Record<string, unknown>).read !== true,
      ).length
    : 0;

  return (
    <MenuButton
      label={session.user.name}
      icon="user"
      iconOnly
      placement="bottom end"
      onAction={async (key) => {
        if (key === "profile") router.history.push("/profile");
        if (key === "notifications") router.history.push("/notifications");
        if (key === "assistant") router.history.push("/assistant");
        if (key === "settings") router.history.push("/settings");
        if (key === "help") router.history.push("/help");
        if (key === "sign-out") {
          await signOut().catch(() => undefined);
          queryClient.removeQueries();
          router.history.push("/sign-in");
        }
      }}
    >
      {allowed.has("P39") && <MenuItem id="profile">Profile</MenuItem>}
      {canViewNotifications && (
        <MenuItem id="notifications">
          {unreadCount
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"}
        </MenuItem>
      )}
      {allowed.has("P41") && <MenuItem id="assistant">Assistant</MenuItem>}
      {allowed.has("P43") && <MenuItem id="settings">Settings</MenuItem>}
      {allowed.has("P42") && <MenuItem id="help">Help</MenuItem>}
      <MenuSeparator />
      <MenuItem id="sign-out">Sign out</MenuItem>
    </MenuButton>
  );
}

export function AppChrome({
  session,
  title,
  children,
}: {
  session: Session;
  title: string;
  children: React.ReactNode;
}) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const area = areaForPath(path);
  const hasSidebar = hasSidebarEntries(session, area);
  const navigation = (
    <>
      <SidebarSection label="Areas">
        <AreaLinks session={session} path={path} />
      </SidebarSection>
      <RoleNavigation session={session} path={path} area={area} />
    </>
  );
  const restricted =
    session.user.restrictions.length > 0 &&
    session.user.roles.includes("student");
  const appearance = useQuery(pageQuery("P43"));
  const standing = useQuery({
    ...pageQuery("P36"),
    enabled: restricted,
  });
  const settings = appearance.data?.data.settings;
  const theme =
    settings && typeof settings === "object" && "theme" in settings
      ? String(settings.theme)
      : "system";
  const savedDensity =
    settings && typeof settings === "object" && "density" in settings
      ? String(settings.density)
      : undefined;
  const defaultDensity = session.user.roles.some((role) =>
    [
      "administrator",
      "chair",
      "dean",
      "guidance",
      "osas",
      "president",
    ].includes(role),
  )
    ? "compact"
    : "comfortable";
  const pausedFeatures =
    standing.data?.data.record && typeof standing.data.data.record === "object"
      ? (standing.data.data.record as Record<string, unknown>).restrictions
      : undefined;

  useEffect(() => {
    if (theme === "system")
      document.documentElement.removeAttribute("data-theme");
    else if (theme === "light" || theme === "dark")
      document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app-chrome">
      {restricted && (
        <div className="app-restricted-banner">
          <Badge tone="warning" form="pending">
            Some features paused
          </Badge>
          <span>
            {Array.isArray(pausedFeatures) && pausedFeatures.length > 0
              ? pausedFeatures
                  .map((entry) => {
                    const restriction = entry as Record<string, unknown>;
                    const features = Array.isArray(restriction.features)
                      ? restriction.features.map(String).join(", ")
                      : "Selected feature";
                    return `${features}, until ${String(restriction.until ?? "review")}`;
                  })
                  .join("; ")
              : "Some account features are paused."}
          </span>
          <a href="/standing">View account standing</a>
        </div>
      )}
      <AppShell
        className={hasSidebar ? undefined : "app-shell--no-sidebar"}
        contentId="main-content"
        density={
          savedDensity === "compact" || savedDensity === "comfortable"
            ? savedDensity
            : defaultDensity
        }
        sidebar={
          hasSidebar ? (
            <RoleSidebar session={session} path={path} area={area} />
          ) : undefined
        }
        mobileBrand={<DoorPlate size="sm" code="ACCS" />}
        mobileNav={navigation}
        mobileActions={<MobileAccountMenu session={session} />}
        topBar={
          <>
            <AppTopBar session={session} title={title} />
            <AppAreaNavigation session={session} path={path} />
          </>
        }
      >
        <div className="app-shell__content" data-area={area}>
          {children}
        </div>
      </AppShell>
    </div>
  );
}
