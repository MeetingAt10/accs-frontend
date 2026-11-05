import {
  Badge,
  Drawer,
  IconButton,
  Link,
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
import {
  DrawerNav,
  SiteRail,
  SiteSidebar,
  type Destination,
  type NavEntry,
  type NavGroup,
  NavLink,
} from "@/components/app/site-chrome";
import { NotificationItem, NotificationList } from "@/components/ds-next";
import {
  ApiError,
  performPageAction,
  signOut,
  type Role,
  type Session,
} from "@/lib/api";
import { pageQuery } from "@/lib/queries";
import {
  allowsPath,
  canOpenSite,
  siteById,
  siteForPath,
  siteLanding,
  sites,
  type SiteId,
} from "@/lib/sites";

type RoleEntry = NavEntry & { pageId?: string };
type RoleGroup = { label: string; entries: RoleEntry[] };

function navigationGroups(session: Session) {
  return [
    ...session.user.roles.flatMap((role) => roleNavigation[role] ?? []),
    ...accountNavigation,
  ];
}

function visibleEntries(session: Session, site?: SiteId) {
  const allowed = new Set(session.allowedPages);
  const seen = new Set<string>();
  return navigationGroups(session).flatMap((group) =>
    group.entries.filter((entry) => {
      if (seen.has(entry.href)) return false;
      const ok =
        (!entry.pageId || allowed.has(entry.pageId)) &&
        (!site || siteForPath(entry.href) === site);
      if (ok) seen.add(entry.href);
      return ok;
    }),
  );
}

/** Sites the session can open (role listed for the site and a page allowed), each with its landing route. */
export function siteDestinations(session: Session): Destination[] {
  // /home redirects administrators to /admin, so their Home destination skips it.
  const isAdmin = session.user.roles.includes("administrator");
  return sites.flatMap((site) => {
    if (!canOpenSite(session, site.id)) return [];
    const entries = visibleEntries(session, site.id);
    const href =
      siteLanding(
        site.id,
        (href) => !(isAdmin && href === "/home") && allowsPath(session, href),
      ) ?? entries.find((entry) => !(isAdmin && entry.href === "/home"))?.href;
    return href ? [{ site, href, entries }] : [];
  });
}

/** Nav groups for one site, with the deepest matching entry marked current (so /cases/clusters does not also mark /cases). */
function siteNav(session: Session, path: string, site: SiteId) {
  const allowed = new Set(session.allowedPages);
  const seen = new Set<string>();
  const groups = navigationGroups(session).flatMap((group) => {
    const entries = group.entries.filter((entry) => {
      const ok =
        !seen.has(entry.href) &&
        (!entry.pageId || allowed.has(entry.pageId)) &&
        siteForPath(entry.href) === site;
      if (ok) seen.add(entry.href);
      return ok;
    });
    return entries.length ? [{ ...group, entries }] : [];
  });
  const current = [...seen]
    .filter((href) => path === href || path.startsWith(href + "/"))
    .sort((x, y) => y.length - x.length)[0];
  return { groups: groups as NavGroup[], current };
}

const roleNavigation: Record<Role, RoleGroup[]> = {
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
        { label: "Accounts", href: "/accounts", icon: "users" },
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
        { label: "Case files", href: "/cases", pageId: "P21", icon: "tray" },
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
  secretary: [
    {
      label: "Workspace",
      entries: [
        { label: "Home", href: "/home", pageId: "P03", icon: "house" },
        { label: "Accounts", href: "/accounts", icon: "users" },
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
};

export const accountNavigation: RoleGroup[] = [
  {
    label: "Account",
    entries: [
      { label: "Notifications", href: "/notifications", pageId: "P40", icon: "bell" },
      { label: "Assistant", href: "/assistant", pageId: "P41", icon: "chat" },
      { label: "My profile", href: "/profile", pageId: "P39", icon: "user" },
      { label: "Directory", href: "/directory", pageId: "P37", icon: "users" },
      { label: "Help", href: "/help", pageId: "P42", icon: "question" },
      { label: "Settings", href: "/settings", pageId: "P43", icon: "gear" },
    ],
  },
];


function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    await signOut().catch(() => undefined);
    queryClient.removeQueries();
    router.history.push("/sign-in");
  };
}

function Topbar({
  title,
  site,
  onMenu,
}: {
  title: string;
  site: SiteId;
  onMenu: () => void;
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
  const siteLabel = siteById[site].label;

  return (
    <>
      <header className="shell-top">
        <IconButton
          className="shell-top__menu"
          icon="list"
          label="Open menu"
          tooltip={false}
          onPress={onMenu}
        />
        <nav className="shell-top__crumb" aria-label="Breadcrumb">
          {title !== siteLabel && (
            <>
              <span className="shell-top__site">{siteLabel}</span>
              <span aria-hidden>/</span>
            </>
          )}
          <strong>{title}</strong>
        </nav>
        <div className="shell-top__tools">
          <form
            className="shell-top__search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (search.trim())
                router.history.push("/feed?q=" + encodeURIComponent(search.trim()));
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
          <IconButton
            icon="chat"
            label="Assistant"
            onPress={() => setAssistantOpen(true)}
          />
          <Popover
            trigger={
              <IconButton
                icon="bell"
                dot={unreadCount > 0}
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
        </div>
      </header>
      <Drawer
        title="Assistant"
        side="end"
        isOpen={assistantOpen}
        onOpenChange={setAssistantOpen}
      >
        <Stack gap={16}>
          <AssistantPanel />
          <Link href="/assistant">Open the assistant page</Link>
        </Stack>
      </Drawer>
    </>
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
  const site = siteForPath(path);
  const destinations = siteDestinations(session);
  const { groups, current } = siteNav(session, path, site);
  const [menuOpen, setMenuOpen] = useState(false);
  const onSignOut = useSignOut();
  const allowed = new Set(session.allowedPages);
  const accountLinks = [
    { label: "Profile", href: "/profile", pageId: "P39", icon: "user" },
    { label: "Notifications", href: "/notifications", pageId: "P40", icon: "bell" },
    { label: "Settings", href: "/settings", pageId: "P43", icon: "gear" },
    { label: "Help", href: "/help", pageId: "P42", icon: "question" },
  ].filter((link) => allowed.has(link.pageId));
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

  // The drawer is a mobile-only surface; any route change closes it.
  useEffect(() => setMenuOpen(false), [path]);

  return (
    <div
      className="app-chrome shell"
      data-site={site}
      data-density={
        savedDensity === "compact" || savedDensity === "comfortable"
          ? savedDensity
          : defaultDensity
      }
    >
      <a className="shell-skip" href="#main-content">
        Skip to main content
      </a>
      {restricted && (
        <div className="shell-banner" role="status">
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
                      : "Some features";
                    return `${features} paused until ${String(restriction.until ?? "review")}`;
                  })
                  .join("; ")
              : "Some account features are paused."}
          </span>
          <NavLink href="/standing">View account standing</NavLink>
        </div>
      )}
      <div className="shell-frame" data-sidebar={groups.length > 0}>
        <SiteRail
          destinations={destinations}
          current={site}
          session={session}
          accountLinks={accountLinks}
          onSignOut={() => void onSignOut()}
        />
        {groups.length > 0 && (
          <SiteSidebar
            site={site}
            groups={groups}
            current={current}
            session={session}
            profileHref={allowed.has("P39") ? "/profile" : undefined}
            onSignOut={() => void onSignOut()}
          />
        )}
        <div className="shell-main">
          <Topbar title={title} site={site} onMenu={() => setMenuOpen(true)} />
          <main className="shell-content" id="main-content" tabIndex={-1}>
            <div className="shell-content__inner">
              <div className="shell-page">{children}</div>
            </div>
          </main>
        </div>
      </div>
      <Drawer title="Menu" side="start" isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerNav
          destinations={destinations}
          current={site}
          groups={groups}
          currentHref={current}
          accountLinks={accountLinks}
          onNavigate={() => setMenuOpen(false)}
          onSignOut={() => void onSignOut()}
        />
      </Drawer>
    </div>
  );
}
