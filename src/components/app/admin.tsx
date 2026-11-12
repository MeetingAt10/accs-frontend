import { PagedList } from '@/components/app/paging'
import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Icon,
  Link,
  Modal,
  ModalActions,
  ModalBody,
  Radio,
  RadioGroup,
  Search,
  Select,
  SelectOption,
  TextArea,
  TextField,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import {
  Empty,
  Kpi,
  Kpis,
  PageHeader,
  Panel,
  StatusChip,
  siteCrumb,
  type Tone,
} from "@/components/app/page-shell";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
  type Role,
} from "@/lib/api";
import {
  formatDateTime,
  initials,
  relativeTime,
} from "@/lib/format";
import { pageQuery, sessionQuery } from "@/lib/queries";

import "./admin.css";

type Item = Record<string, unknown>;

const object = (value: unknown): Item =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Item)
    : {};
const items = (value: unknown): Item[] =>
  Array.isArray(value) ? value.map(object) : [];
const word = (value: unknown, fallback = "") =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
const cap = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const roles: Role[] = [
  "student",
  "organization",
  "professor",
  "staff",
  "chair",
  "dean",
  "administrator",
  "guidance",
  "osas",
  "president",
  "secretary",
];
const SHORT: Record<string, string> = {
  student: "Student",
  organization: "Student org",
  professor: "Professor",
  staff: "CCS staff",
  chair: "Chair",
  dean: "Dean",
  administrator: "Admin",
  guidance: "Guidance",
  osas: "OSAS",
  president: "President",
  secretary: "Secretary",
};
const FULL: Record<string, string> = {
  student: "Student",
  organization: "CCS student organization",
  professor: "Professor",
  staff: "CCS staff",
  chair: "Program chair",
  dean: "Dean",
  administrator: "Administrator / Moderator",
  guidance: "Guidance",
  osas: "OSAS",
  president: "President's Office",
  secretary: "CCS secretary",
};
const roleShort = (role: string) => SHORT[role] ?? cap(role);
const roleFull = (role: string) => FULL[role] ?? cap(role);

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const trail = (...rest: Array<{ label: string; href?: string }>) => [
  siteCrumb("/admin"),
  ...rest,
];

const manilaDay = (value: unknown) => {
  const date = new Date(word(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

function useAction(pageId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["page"] }),
        client.invalidateQueries({ queryKey: ["session"] }),
      ]);
      toast(result.message, { tone: "success" });
    },
  });
}

/* ---------- Motion + small shared pieces ---------- */

/** Counts up to `value` once on mount and whenever it changes. */
function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = value.toLocaleString();
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString();
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>0</span>;
}

const kpiValue = (value: unknown): ReactNode =>
  typeof value === "number" ? <Counter value={value} /> : word(value, "—");

type Meter = { label: string; value: number; display?: string; tone?: string };

/** Horizontal bars that grow in from the left. */
function Meters({ rows }: { rows: Meter[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="adm-meters">
      {rows.map((row, index) => (
        <li className="adm-meter" key={`${row.label}-${index}`}>
          <span className="adm-meter__label" title={row.label}>
            {row.label}
          </span>
          <span className="adm-meter__track" aria-hidden>
            <motion.span
              className="adm-meter__fill"
              data-tone={row.tone}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: row.value / max }}
              transition={{
                duration: 0.7,
                delay: 0.15 + index * 0.04,
                ease: EASE,
              }}
            />
          </span>
          <span className="adm-meter__value accs-num">
            {row.display ?? row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Filter pills with one sliding ink indicator. */
function Pills<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="adm-filter" role="group" aria-label={label}>
      <span className="adm-filter__label" aria-hidden>
        {label}
      </span>
      <LayoutGroup id={id}>
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            className="accs-pill adm-pill"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {value === option.id && (
              <motion.span
                layoutId="indicator"
                className="adm-pill__bg"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 38 }
                }
              />
            )}
            {option.label}
            {option.count !== undefined && (
              <span className="accs-pill__count">{option.count}</span>
            )}
          </button>
        ))}
      </LayoutGroup>
    </div>
  );
}

const Time = ({ value }: { value: unknown }) => (
  <span className="accs-mono adm-time" title={word(value)}>
    {formatDateTime(value)}
  </span>
);

const Facts = ({ rows }: { rows: Array<[string, ReactNode]> }) => (
  <dl className="adm-facts">
    {rows.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="adm-note">
    <Icon name="info" size={16} />
    <span>{children}</span>
  </p>
);

const Tags = ({ values }: { values: string[] }) => (
  <span className="adm-tags">
    {values.length ? (
      values.map((value) => (
        <span className="accs-tag" key={value} title={roleFull(value)}>
          {roleShort(value)}
        </span>
      ))
    ) : (
      <span className="adm-muted">—</span>
    )}
  </span>
);

const modTone = (status: string): Tone =>
  status === "Pending"
    ? "warn"
    : status === "Kept"
      ? "ok"
      : /removed/i.test(status)
        ? "danger"
        : "info";

const DECISIONS: Record<string, string> = {
  keep: "Kept, no action",
  remove: "Content removed",
  warn: "Removed, author warned",
  refer: "Referred for authorized review",
};

/* ---------- P48 Permission matrix ---------- */

export function PermissionMatrix({ page }: { page: PageEnvelope }) {
  const action = useAction("P48");
  const reduce = useReducedMotion();
  const matrix = items(page.data.permissionMatrix);
  const proposals = object(page.data.permissionProposals);
  const proposalList = Object.entries(proposals);
  const [reason, setReason] = useState("");
  const [pendingCell, setPendingCell] = useState<{
    role: Role;
    permission: string;
    allowed: boolean;
  }>();
  const doChange = () => {
    if (!pendingCell || !reason.trim()) return;
    action.mutate(
      { action: "updatePermission", payload: pendingCell, reason },
      {
        onSuccess: () => {
          setPendingCell(undefined);
          setReason("");
        },
      },
    );
  };
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail({ label: "Permissions" })}
        title="Permission matrix"
        description="Propose a change to what a role can do. CCS reviews each proposal."
      />
      <div className="accs-stack accs-stack--tight">
        <Note>
          Role changes take effect at the next sign-in. This matrix does not
          decide case outcomes or restrictions.
        </Note>
        <div className="adm-legend" aria-label="Legend">
          <span>
            <i data-s="on">
              <Icon name="check" size={16} />
            </i>
            Allowed
          </span>
          <span>
            <i data-s="off">
              <Icon name="minus" size={16} />
            </i>
            No access
          </span>
          <span>
            <i data-s="proposed">
              <Icon name="plus" size={16} />
            </i>
            Proposed change
          </span>
        </div>
      </div>
      <div
        className="adm-matrix-wrap"
        role="region"
        aria-label="Permissions by role"
        tabIndex={0}
      >
        <table className="adm-matrix">
          <thead>
            <tr>
              <th scope="col" className="adm-matrix__perm">
                Permission
              </th>
              {roles.map((role) => (
                <th scope="col" key={role} title={roleFull(role)}>
                  <span className="adm-matrix__role">{roleShort(role)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((entry, index) => {
              const permission = word(entry.key);
              const group = permission.split(".")[0] ?? "";
              const previous = word(matrix[index - 1]?.key).split(".")[0];
              const granted = strings(entry.roles);
              return (
                <Fragment key={permission}>
                  {(index === 0 || group !== previous) && (
                    <tr className="adm-matrix__group">
                      <th scope="rowgroup" colSpan={roles.length + 1}>
                        {group}
                      </th>
                    </tr>
                  )}
                  <tr>
                    <th scope="row" className="adm-matrix__perm">
                      <span className="adm-matrix__key accs-mono">
                        {permission}
                      </span>
                      <span className="adm-matrix__human">
                        {cap(permission.replace(/[._]/g, " "))}
                      </span>
                    </th>
                    {roles.map((role) => {
                      const proposed = proposals[`${role}:${permission}`];
                      const hasProposal = proposed !== undefined;
                      const effective = hasProposal
                        ? Boolean(proposed)
                        : granted.includes(role);
                      return (
                        <td key={role}>
                          <MatrixCell
                            on={effective}
                            proposed={hasProposal}
                            label={`${roleFull(role)}: ${permission}, ${
                              effective ? "allowed" : "no access"
                            }${hasProposal ? " (proposed)" : ""}. Propose a change`}
                            onPress={() =>
                              setPendingCell({
                                role,
                                permission,
                                allowed: !effective,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {action.error && (
        <Alert tone="danger" title="The proposal couldn't be saved">
          {action.error.message}
        </Alert>
      )}
      <AnimatePresence>
        {proposalList.length > 0 && (
          <motion.aside
            key="proposed"
            className="adm-proposed"
            aria-label="Proposed changes"
            initial={reduce ? false : { y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 56, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
          >
            <span className="adm-proposed__head">
              <Icon name="list-checks" size={20} />
              Proposed changes
              <span className="adm-proposed__count">{proposalList.length}</span>
            </span>
            <ul className="adm-proposed__list">
              <AnimatePresence initial={false}>
                {proposalList.slice(0, 8).map(([key, value]) => {
                  const [role = "", ...rest] = key.split(":");
                  return (
                    <motion.li
                      key={key}
                      layout={!reduce}
                      className="adm-proposed__chip"
                      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.25, ease: EASE }}
                    >
                      {roleShort(role)} ·{" "}
                      <span className="accs-mono">{rest.join(":")}</span>
                      <b>{value ? "allow" : "remove"}</b>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {proposalList.length > 8 && (
                <li className="adm-proposed__chip">
                  +{proposalList.length - 8} more
                </li>
              )}
            </ul>
            <p className="adm-proposed__note">
              CCS reviews each proposal. Approved changes apply at each
              person's next sign-in.
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
      <Modal
        title="Propose permission change"
        isOpen={Boolean(pendingCell)}
        onOpenChange={(open) => {
          if (!open) setPendingCell(undefined);
        }}
      >
        <ModalBody>
          <p>
            {pendingCell?.allowed ? "Allow" : "Remove"}{" "}
            <strong>{pendingCell?.role}</strong> access to{" "}
            <strong>{pendingCell?.permission}</strong>.
          </p>
          <TextArea
            label="Reason"
            isRequired
            value={reason}
            onChange={setReason}
            maxLength={1000}
          />
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setPendingCell(undefined)}>
            Cancel
          </Button>
          <Button
            loading={action.isPending}
            isDisabled={!reason.trim()}
            onPress={doChange}
          >
            Submit proposal
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

function MatrixCell({
  on,
  proposed,
  label,
  onPress,
}: {
  on: boolean;
  proposed: boolean;
  label: string;
  onPress: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      className="adm-cell"
      data-on={on}
      data-proposed={proposed}
      aria-label={label}
      onClick={onPress}
      whileHover={reduce ? undefined : { scale: 1.08 }}
      whileTap={reduce ? undefined : { scale: 0.88 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${on}-${proposed}`}
          className="adm-cell__glyph"
          initial={reduce ? false : { scale: 0.3, opacity: 0, rotate: -45 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.3, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 22 }}
        >
          <Icon
            name={on ? "check" : "minus"}
            size={16}
            weight={on ? "bold" : "regular"}
          />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/* ---------- Service status ---------- */

export function SystemStatus({ status }: { status: Item }) {
  const api = word(status.api, "Unknown");
  const storage = word(status.storage, "Unknown");
  const rows: Array<{
    name: string;
    detail: string;
    value: string;
    tone: Tone;
  }> = [
    {
      name: "API",
      detail: "Serves every request the app makes",
      value: api,
      tone: /operational|healthy|ok/i.test(api)
        ? "ok"
        : /degrad|slow/i.test(api)
          ? "warn"
          : /down|fail|outage/i.test(api)
            ? "danger"
            : "neutral",
    },
    {
      name: "Assistant",
      detail: "Answers questions in the assistant",
      value: word(status.assistant, "Unknown"),
      tone: "neutral",
    },
    {
      name: "Storage",
      detail: /memory/i.test(storage)
        ? "Records reset when the app restarts"
        : "Where records are kept",
      value: storage,
      tone: /memory/i.test(storage) ? "warn" : "neutral",
    },
  ];
  return (
    <Panel flush title="Service status">
      <ul className="adm-rows">
        {rows.map((row) => (
          <li key={row.name}>
            <div className="adm-status-row">
              <p className="adm-status-row__name">{row.name}</p>
              <StatusChip tone={row.tone}>{row.value}</StatusChip>
              <p className="adm-status-row__detail">{row.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- P45 Overview ---------- */

const NAV: Array<{ href: string; label: string }> = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Permissions" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/restrictions", label: "Restrictions" },
  { href: "/admin/audit", label: "Audit trail" },
  { href: "/admin/monitoring", label: "Monitoring" },
];

function AuditTable({ rows }: { rows: Item[] }) {
  return (
    <PagedList items={rows} noun="events">
      {(rows) => (
      <div className="adm-scroll">
        <table className="accs-table adm-stack adm-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Module</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, index) => (
              <tr key={word(entry.id, String(index))}>
                <td data-label="Time">
                  <Time value={entry.at} />
                </td>
                <td data-label="Actor">
                  {word(object(entry.actor).name, "System")}
                </td>
                <td data-label="Action">{word(entry.action)}</td>
                <td data-label="Module">
                  <span className="accs-tag">{word(entry.module, "—")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </PagedList>
  );
}

function AdminOverview({ page }: { page: PageEnvelope }) {
  const stats = items(page.data.stats);
  const adoption = items(page.data.adoption);
  const status = object(page.data.systemStatus);
  const moderation = items(page.data.moderation);
  const audit = items(page.data.audit);
  const stat = (label: string) =>
    stats.find((entry) => word(entry.label) === label)?.value;
  const pending = moderation.filter((entry) => word(entry.status) === "Pending");
  const today = manilaDay(new Date().toISOString());
  const todayCount = audit.filter((entry) => manilaDay(entry.at) === today)
    .length;
  const capped = audit.length >= 5 && todayCount === audit.length;
  const queue = stat("Pending reviews");
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        title="Administration"
      />
      <nav className="adm-nav" aria-label="Administration pages">
        {NAV.map((entry) => (
          <Link key={entry.href} className="adm-nav__link" href={entry.href}>
            {entry.label}
            {entry.href === "/admin/moderation" &&
              typeof queue === "number" &&
              queue > 0 && <span className="adm-nav__count">{queue}</span>}
          </Link>
        ))}
      </nav>
      <Kpis label="System summary">
        <Kpi
          label="Users"
          value={kpiValue(stat("Active accounts"))}
          note="Active accounts"
          href="/admin/users"
        />
        <Kpi
          label="Active restrictions"
          value={kpiValue(stat("Active restrictions"))}
          note="Limits on single features"
          href="/restrictions"
        />
        <Kpi
          label="Moderation queue"
          value={kpiValue(queue)}
          note="Waiting for a decision"
          href="/admin/moderation"
        />
        <Kpi
          label="Audit events today"
          value={<Counter value={todayCount} />}
          note={capped ? "Latest 5 shown" : "Since midnight"}
          href="/admin/audit"
        />
      </Kpis>
      <div className="adm-cols">
        <Panel
          flush
          title="Waiting for review"
          action={
            <Link variant="standalone" href="/admin/moderation">
              Open queue
            </Link>
          }
        >
          {pending.length ? (
            <ul className="adm-rows">
              {pending.map((entry) => (
                <li key={word(entry.id)}>
                  <div className="adm-row">
                    <div>
                      <p className="adm-row__title">
                        <Link
                          className="adm-link"
                          variant="quiet"
                          href={`/admin/moderation/${encodeURIComponent(word(entry.id))}`}
                        >
                          {cap(word(entry.itemType, "Item"))} flagged for review
                        </Link>
                      </p>
                      <p className="adm-row__sub">
                        <span className="accs-tag">
                          {word(entry.source, "—")}
                        </span>
                        {entry.reason ? (
                          <span>{word(entry.reason)}</span>
                        ) : null}
                        <span className="accs-mono">{word(entry.id)}</span>
                      </p>
                    </div>
                    <span
                      className="adm-row__age"
                      title={formatDateTime(entry.at)}
                    >
                      {relativeTime(entry.at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing needs review">
              Reported posts, comments, and messages show up here.
            </Empty>
          )}
        </Panel>
        <Panel
          flush
          title="Recent audit events"
          action={
            <Link variant="standalone" href="/admin/audit">
              Open audit trail
            </Link>
          }
        >
          {audit.length ? (
            <AuditTable rows={audit} />
          ) : (
            <Empty title="No audit events yet">
              Role, permission, and moderation actions show up here.
            </Empty>
          )}
        </Panel>
      </div>
      <div className="adm-cols">
        <SystemStatus status={status} />
        <Panel flush title="Accounts by role">
          {adoption.length ? (
            <Meters
              rows={adoption.map((entry) => ({
                label: word(entry.label),
                value: Number(entry.value ?? 0),
              }))}
            />
          ) : (
            <Empty title="No accounts yet" />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------- P46 Users ---------- */

function UsersPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const users = items(page.data.users);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const rolesPresent = roles.filter((role) =>
    users.some((user) => strings(user.roles).includes(role)),
  );
  const results = users.filter(
    (user) =>
      `${word(user.name)} ${word(user.id)} ${word(user.email)} ${word(user.program)} ${word(user.office)}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (roleFilter === "all" || strings(user.roles).includes(roleFilter)) &&
      (statusFilter === "all" ||
        (statusFilter === "active") === (user.active !== false)),
  );
  const filtered =
    search !== "" || roleFilter !== "all" || statusFilter !== "all";
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail({ label: "Users" })}
        title="Users and roles"
        description="Role changes take effect at the next sign-in and go in the audit trail."
        actions={
          <Button
            variant="secondary"
            icon="plus"
            onPress={() => setAssignOpen(true)}
          >
            Assign role
          </Button>
        }
      />
      <div className="accs-toolbar adm-toolbar">
        <Search
          className="adm-search"
          label="Search users"
          placeholder="Search name, QCU ID, or email"
          size="sm"
          value={search}
          onChange={setSearch}
        />
        <Pills
          id="user-role"
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { id: "all", label: "All", count: users.length },
            ...rolesPresent.map((role) => ({
              id: role as string,
              label: roleShort(role),
              count: users.filter((user) =>
                strings(user.roles).includes(role),
              ).length,
            })),
          ]}
        />
        <Pills
          id="user-status"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: "all", label: "Any" },
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
          ]}
        />
        <span className="adm-toolbar__count" aria-live="polite">
          {results.length} of {users.length}
        </span>
      </div>
      {results.length ? (
        <PagedList items={results} noun="users">
          {(results) => (
          <div className="accs-table-wrap">
            <table className="accs-table adm-stack adm-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Roles</th>
                  <th scope="col">Program</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((user) => {
                  const name = word(user.name, "Unnamed account");
                  const active = user.active !== false;
                  return (
                    <tr key={word(user.id)}>
                      <td>
                        <div className="adm-person">
                          <span className="accs-avatar" aria-hidden>
                            {initials(name)}
                          </span>
                          <span className="adm-person__text">
                            <Link
                              className="adm-link"
                              variant="quiet"
                              href={`/admin/users/${encodeURIComponent(word(user.id))}`}
                            >
                              {name}
                            </Link>
                            <span className="adm-person__sub accs-mono">
                              {word(user.id)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Email">{word(user.email, "—")}</td>
                      <td data-label="Roles">
                        <Tags values={strings(user.roles)} />
                      </td>
                      <td data-label="Program">
                        {word(user.program, word(user.office, "—"))}
                      </td>
                      <td data-label="Status">
                        <StatusChip tone={active ? "ok" : "neutral"}>
                          {active ? "Active" : "Inactive"}
                        </StatusChip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </PagedList>
      ) : (
        <div className="accs-panel">
          <Empty
            title="No users match"
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setSearch("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          >
            Check the spelling or search by QCU ID or email.
          </Empty>
        </div>
      )}
      <Modal
        title="Assign a role"
        isOpen={assignOpen}
        onOpenChange={setAssignOpen}
      >
        <ModalBody>
          <Select
            label="Choose a user"
            selectedKey={selectedUser || null}
            onSelectionChange={(key) => setSelectedUser(String(key))}
          >
            {users.map((user) => (
              <SelectOption key={word(user.id)} id={word(user.id)}>
                {word(user.name)} · {word(user.id)}
              </SelectOption>
            ))}
          </Select>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button
            isDisabled={!selectedUser}
            onPress={() => {
              setAssignOpen(false);
              router.history.push(
                "/admin/users/" + encodeURIComponent(selectedUser),
              );
            }}
          >
            Open account
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

/* ---------- P47 User detail ---------- */

function UserDetail({ page, userId }: { page: PageEnvelope; userId: string }) {
  const record = object(page.data.record);
  const action = useAction("P47");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(
    Array.isArray(record.roles) ? (record.roles as Role[]) : [],
  );
  const [program, setProgram] = useState(word(record.program));
  const [section, setSection] = useState(word(record.section));
  const [reason, setReason] = useState("");
  const audit = items(page.data.audit);
  if (!record.id)
    return (
      <ViewState
        kind="restricted"
        title="This account isn't available"
        description="It may not exist, or it may be outside your access."
      />
    );
  const name = word(record.name, "Account");
  const active = record.active !== false;
  const standing = word(record.standing, "Good standing");
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail({ label: "Users", href: "/admin/users" }, { label: name })}
        title={
          <span className="adm-person">
            <span className="accs-avatar" aria-hidden>
              {initials(name)}
            </span>
            {name}
          </span>
        }
        description={
          <>
            <span className="accs-mono">{word(record.id)}</span> ·{" "}
            {word(record.email, "No email on file")}
          </>
        }
        actions={
          <StatusChip tone={active ? "ok" : "neutral"}>
            {active ? "Active" : "Inactive"}
          </StatusChip>
        }
      />
      <div className="accs-split">
        <Panel title="Roles and assignment">
          <div className="adm-form">
            <Note>
              Role changes apply at the next sign-in. The current session keeps
              its roles. The audit trail records this change.
            </Note>
            <CheckboxGroup
              label="Assigned roles"
              value={selectedRoles}
              onChange={(next) => setSelectedRoles(next as Role[])}
            >
              {roles.map((role) => (
                <Checkbox key={role} value={role}>
                  {roleFull(role)}
                </Checkbox>
              ))}
            </CheckboxGroup>
            <div className="adm-form__grid">
              <TextField
                label="Program"
                value={program}
                onChange={setProgram}
              />
              <TextField
                label="Section"
                value={section}
                onChange={setSection}
              />
            </div>
            <TextArea
              label="Reason"
              isRequired
              value={reason}
              onChange={setReason}
              maxLength={1000}
            />
            {action.error && (
              <Alert tone="danger" title="The role change couldn't be saved">
                {action.error.message}
              </Alert>
            )}
            <div className="adm-form__actions">
              <Button
                loading={action.isPending}
                isDisabled={!selectedRoles.length || !reason.trim()}
                onPress={() =>
                  action.mutate({
                    action: "updateRoles",
                    recordId: userId,
                    payload: {
                      roles: selectedRoles,
                      ...(program ? { program } : {}),
                      ...(section ? { section } : {}),
                    },
                    reason,
                  })
                }
              >
                Save assignments
              </Button>
            </div>
          </div>
        </Panel>
        <div className="accs-stack">
          <Panel title="Profile">
            <Facts
              rows={[
                ["QCU ID", <span className="accs-mono">{word(record.id)}</span>],
                ["Email", word(record.email, "—")],
                ["Roles", <Tags values={strings(record.roles)} />],
                ["Program", word(record.program, "—")],
                ["Section", word(record.section, "—")],
                ["Office", word(record.office, "—")],
                ["Title", word(record.title, "—")],
              ]}
            />
          </Panel>
          <Panel title="Restrictions">
            <Facts
              rows={[
                [
                  "Standing",
                  <StatusChip
                    tone={standing === "Good standing" ? "ok" : "warn"}
                  >
                    {standing}
                  </StatusChip>,
                ],
              ]}
            />
            <Button variant="tertiary" size="sm" href="/restrictions">
              Manage restrictions
            </Button>
          </Panel>
          <Panel title="Recent activity">
            {audit.length ? (
              <ol className="accs-timeline">
                {audit.map((entry, index) => (
                  <li key={word(entry.id, String(index))}>
                    <div className="adm-timeline-body">
                      <strong>{word(entry.action)}</strong>
                      <span>
                        {word(object(entry.actor).name, "System")} ·{" "}
                        {word(entry.module)}
                      </span>
                      {entry.reason ? <span>{word(entry.reason)}</span> : null}
                      <span className="accs-timeline__time accs-mono">
                        {formatDateTime(entry.at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title="No recorded activity">
                Role changes and account events for this person show up here.
                Sign-in history isn't recorded.
              </Empty>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------- P49 Moderation queue ---------- */

function ModerationQueue({ page }: { page: PageEnvelope }) {
  const moderation = items(page.data.moderation);
  const [status, setStatus] = useState("Pending");
  const [type, setType] = useState("All");
  const isPending = (item: Item) => word(item.status) === "Pending";
  const visible = moderation.filter(
    (item) =>
      (status === "All" ||
        (status === "Pending" ? isPending(item) : !isPending(item))) &&
      (type === "All" || word(item.itemType) === type),
  );
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail({ label: "Moderation" })}
        title="Moderation"
        description="A flag is not proof of a violation. Read the context before you decide."
      />
      <div className="accs-toolbar adm-toolbar">
        <Pills
          id="mod-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            {
              id: "Pending",
              label: "Pending",
              count: moderation.filter(isPending).length,
            },
            {
              id: "Decided",
              label: "Decided",
              count: moderation.filter((item) => !isPending(item)).length,
            },
            { id: "All", label: "All", count: moderation.length },
          ]}
        />
        <Pills
          id="mod-type"
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { id: "All", label: "All" },
            { id: "post", label: "Post" },
            { id: "comment", label: "Comment" },
            { id: "message", label: "Message" },
          ]}
        />
        <span className="adm-toolbar__count" aria-live="polite">
          {visible.length} shown
        </span>
      </div>
      {visible.length ? (
        <PagedList items={visible} noun="items">
          {(visible) => (
          <div className="accs-table-wrap">
            <table className="accs-table adm-stack adm-table">
              <thead>
                <tr>
                  <th scope="col">Content</th>
                  <th scope="col">Type</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reported</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={word(item.id)}>
                    <td>
                      <span className="adm-person__text">
                        <Link
                          className="adm-link"
                          variant="quiet"
                          href={`/admin/moderation/${encodeURIComponent(word(item.id))}`}
                        >
                          <span className="adm-trunc adm-trunc--wide">
                            {word(item.excerpt, cap(word(item.itemType, "Item")))}
                          </span>
                        </Link>
                        <span className="adm-person__sub accs-mono">
                          {word(item.id)}
                        </span>
                      </span>
                    </td>
                    <td data-label="Type">
                      <span className="accs-tag">
                        {cap(word(item.itemType, "—"))}
                      </span>
                    </td>
                    <td data-label="Reason">{word(item.reason, "—")}</td>
                    <td data-label="Source">{word(item.source, "—")}</td>
                    <td data-label="Status">
                      <StatusChip tone={modTone(word(item.status))}>
                        {word(item.status, "—")}
                      </StatusChip>
                    </td>
                    <td data-label="Reported">
                      <span className="adm-time" title={formatDateTime(item.at)}>
                        {relativeTime(item.at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </PagedList>
      ) : (
        <div className="accs-panel">
          <Empty title="Nothing to review">
            {status === "Pending"
              ? "No items are waiting for a decision."
              : "No items match these filters."}
          </Empty>
        </div>
      )}
    </div>
  );
}

/* ---------- P50 Moderation item ---------- */

function ModerationReview({
  page,
  itemId,
}: {
  page: PageEnvelope;
  itemId: string;
}) {
  const record = object(page.data.record);
  const action = useAction("P50");
  const [decision, setDecision] = useState("keep");
  const [reason, setReason] = useState("");
  const [notifyAuthor, setNotifyAuthor] = useState(true);
  if (!record.id)
    return (
      <ViewState
        kind="restricted"
        title="This item isn't available"
        description="It may not exist or may no longer be visible."
      />
    );
  const userReport = record.source === "User";
  const messages = items(page.data.messages);
  const post = object(page.data.post);
  const history = items(record.history);
  const status = word(record.status, "—");
  const itemType = word(record.itemType, "item");
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail(
          { label: "Moderation", href: "/admin/moderation" },
          { label: word(record.id) },
        )}
        title={`Flagged ${itemType}`}
        description={`${word(record.source, "Review")} · reported ${formatDateTime(record.at)}`}
        actions={<StatusChip tone={modTone(status)}>{status}</StatusChip>}
      />
      <div className="accs-split">
        <div className="accs-stack">
          <Panel title="Flagged content">
            <div className="adm-context">
              {messages.length ? (
                messages.map((message) => (
                  <div key={word(message.id)}>
                    <blockquote className="adm-quote">
                      {word(message.body)}
                    </blockquote>
                    <p className="adm-quote__by">
                      {word(object(message.author).name, "Community member")} ·{" "}
                      {formatDateTime(message.at)}
                    </p>
                  </div>
                ))
              ) : (
                <div>
                  {word(post.title) && (
                    <p className="accs-row__title">{word(post.title)}</p>
                  )}
                  <blockquote className="adm-quote">
                    {word(
                      record.excerpt,
                      word(post.body, "Content is not available."),
                    )}
                  </blockquote>
                </div>
              )}
              <Note>
                A flag does not establish a rule violation. This screen does not
                apply restrictions.
              </Note>
            </div>
          </Panel>
          {status === "Pending" && (
            <Panel title="Decision">
              <div className="adm-form">
                <RadioGroup
                  label="Decision"
                  value={decision}
                  onChange={setDecision}
                >
                  <Radio value="keep" card>
                    Keep, no action
                  </Radio>
                  <Radio value="remove" card>
                    Remove content
                  </Radio>
                  <Radio value="warn" card>
                    Remove and warn the author
                  </Radio>
                  <Radio value="refer" card isDisabled={!userReport}>
                    {userReport
                      ? "Refer as a possible grievance"
                      : "Refer as a possible grievance (user reports only)"}
                  </Radio>
                </RadioGroup>
                <TextArea
                  label="Reason"
                  isRequired
                  value={reason}
                  onChange={setReason}
                  maxLength={1000}
                />
                <Checkbox isSelected={notifyAuthor} onChange={setNotifyAuthor}>
                  Notify the author if policy allows
                </Checkbox>
                {action.error && (
                  <Alert tone="danger" title="The decision couldn't be recorded">
                    {action.error.message}
                  </Alert>
                )}
                <div className="adm-form__actions">
                  <Button
                    loading={action.isPending}
                    isDisabled={!reason.trim()}
                    onPress={() =>
                      action.mutate({
                        action: "moderate",
                        recordId: itemId,
                        payload: { decision, notifyAuthor },
                        reason,
                      })
                    }
                  >
                    Record decision
                  </Button>
                  <Link variant="standalone" href="/restrictions">
                    Apply an approved restriction
                  </Link>
                </div>
              </div>
            </Panel>
          )}
        </div>
        <div className="accs-stack">
          <Panel title="Details">
            <Facts
              rows={[
                ["Reason", word(record.reason, "—")],
                ["Source", word(record.source, "—")],
                [
                  "Reporter",
                  record.reporter
                    ? word(
                        object(record.reporter).name,
                        "Verified community member",
                      )
                    : "Automated review",
                ],
                [
                  "Status",
                  <StatusChip tone={modTone(status)}>{status}</StatusChip>,
                ],
                ["Item", <span className="accs-mono">{word(record.id)}</span>],
              ]}
            />
          </Panel>
          <Panel title="History">
            <ol className="accs-timeline">
              <li>
                <div className="adm-timeline-body">
                  <strong>
                    Flagged{userReport ? " by a community member" : " by filter"}
                  </strong>
                  <span>{word(record.reason, "No reason given")}</span>
                  <span className="accs-timeline__time accs-mono">
                    {formatDateTime(record.at)}
                  </span>
                </div>
              </li>
              {history.map((entry, index) => (
                <li key={`${word(entry.at)}-${index}`}>
                  <div className="adm-timeline-body">
                    <strong>
                      {DECISIONS[word(entry.decision)] ??
                        cap(word(entry.decision, "Decision recorded"))}
                    </strong>
                    {entry.reason ? <span>{word(entry.reason)}</span> : null}
                    <span className="accs-timeline__time accs-mono">
                      {formatDateTime(entry.at)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------- P52 Monitoring ---------- */

const STAT_NOTES: Array<[RegExp, string]> = [
  [/session/i, "Since the app started"],
  [/fail/i, "Responses that failed"],
  [/median|response/i, "Since the app started"],
];

export function SystemMonitoring({ page }: { page: PageEnvelope }) {
  const reduce = useReducedMotion();
  const stats = items(page.data.stats);
  const trend = items(page.data.trend);
  const incidents = items(page.data.incidents);
  const telemetry = items(page.data.telemetry);
  const recent = telemetry.slice(-10).reverse();
  const peak = Math.max(1, ...trend.map((row) => Number(row.value ?? 0)));
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail({ label: "Monitoring" })}
        title="Monitoring"
        description="Service status and assistant activity since the app last started. Conversation text is never shown."
      />
      <Kpis label="Process metrics">
        {stats.map((entry) => (
          <Kpi
            key={word(entry.label)}
            label={word(entry.label)}
            value={kpiValue(entry.value)}
            note={STAT_NOTES.find(([test]) => test.test(word(entry.label)))?.[1]}
          />
        ))}
      </Kpis>
      <div className="adm-cols">
        <SystemStatus status={object(page.data.systemStatus)} />
        <Panel flush title="Assistant sessions per day">
          {trend.length ? (
            <div className="adm-trend-wrap">
              <div className="adm-trend" role="list">
                {trend.map((row, index) => {
                  const value = Number(row.value ?? 0);
                  return (
                    <div className="adm-trend__col" role="listitem" key={index}>
                      <motion.span
                        className="adm-trend__bar"
                        initial={reduce ? false : { scaleY: 0 }}
                        animate={{ scaleY: value / peak }}
                        transition={{
                          duration: 0.8,
                          delay: 0.2 + index * 0.05,
                          ease: EASE,
                        }}
                      />
                      <span className="adm-trend__value accs-mono">
                        {value}
                      </span>
                      <span className="adm-trend__label accs-mono">
                        {word(row.label)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Empty title="No activity yet">
              Sessions show up here after someone uses the assistant.
            </Empty>
          )}
        </Panel>
      </div>
      <div className="adm-cols">
        <Panel flush title="Recent response times">
          {recent.length ? (
            <Meters
              rows={recent.map((entry) => ({
                label: formatDateTime(entry.at),
                value: Number(entry.durationMs ?? 0),
                display: `${word(entry.durationMs, "0")} ms`,
                tone: entry.success ? undefined : "danger",
              }))}
            />
          ) : (
            <Empty title="No timings recorded">
              The last 10 assistant answers show up here.
            </Empty>
          )}
        </Panel>
        <Panel flush title="Incidents">
          {incidents.length ? (
            <ul className="adm-rows">
              {incidents.map((incident) => (
                <li key={word(incident.id)}>
                  <div className="adm-row">
                    <div>
                      <p className="adm-row__title">
                        {word(incident.service, "Service")}
                      </p>
                      <p className="adm-row__sub">{word(incident.note)}</p>
                    </div>
                    <Time value={incident.start} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No incidents recorded">
              Any incident since the app started shows up here.
            </Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------- P51 Audit trail ---------- */

const AUDIT_PAGE = 25;
const AUDIT_MODULES = [
  "identity",
  "restrictions",
  "cases",
  "moderation",
  "records",
];
const AUDIT_ACTIONS = [
  "Role assignment changed",
  "Permission change proposed",
  "Restriction applied",
  "Restriction lifted",
  "Case transition",
  "Moderation decision",
  "Identity disclosed",
  "Record opened",
];

function AuditLogPage({ page }: { page: PageEnvelope }) {
  const rows = items(page.data.audit);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPageIndex(0);
    };
  const filtered = rows.filter((row) => {
    const text =
      `${word(row.action)} ${word(row.module)} ${word(row.reference)} ${word(object(row.actor).name)}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (module === "All" || word(row.module) === module) &&
      (actionFilter === "All" || word(row.action) === actionFilter) &&
      (!from || word(row.at).slice(0, 10) >= from) &&
      (!to || word(row.at).slice(0, 10) <= to)
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE));
  const current = Math.min(pageIndex, pages - 1);
  const start = current * AUDIT_PAGE;
  const shown = filtered.slice(start, start + AUDIT_PAGE);
  const filtering =
    query !== "" ||
    module !== "All" ||
    actionFilter !== "All" ||
    from !== "" ||
    to !== "";
  return (
    <div className="accs-stack accs-stagger adm">
      <PageHeader
        crumbs={trail({ label: "Audit trail" })}
        title="Audit trail"
        description="Each entry shows a reference, never report text or message text."
      />
      <div className="accs-toolbar adm-toolbar">
        <Search
          className="adm-search"
          label="Search audit entries"
          placeholder="Search actor, action, module, or reference"
          size="sm"
          value={query}
          onChange={reset(setQuery)}
        />
        <span className="adm-toolbar__count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
        </span>
        <div className="adm-filters-grid">
          <Select
            label="Module"
            selectedKey={module}
            onSelectionChange={(key) => reset(setModule)(String(key))}
          >
            <SelectOption id="All">All modules</SelectOption>
            {AUDIT_MODULES.map((value) => (
              <SelectOption key={value} id={value}>
                {cap(value)}
              </SelectOption>
            ))}
          </Select>
          <Select
            label="Action"
            selectedKey={actionFilter}
            onSelectionChange={(key) => reset(setActionFilter)(String(key))}
          >
            <SelectOption id="All">All actions</SelectOption>
            {AUDIT_ACTIONS.map((value) => (
              <SelectOption key={value} id={value}>
                {value}
              </SelectOption>
            ))}
          </Select>
          <TextField
            type="date"
            label="From"
            value={from}
            onChange={reset(setFrom)}
          />
          <TextField
            type="date"
            label="To"
            value={to}
            onChange={reset(setTo)}
          />
        </div>
      </div>
      {shown.length ? (
        <div className="accs-panel accs-panel--flush adm-table-panel">
          <div className="adm-scroll">
            <table className="accs-table adm-stack adm-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Module</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, index) => (
                  <tr key={word(entry.id, String(start + index))}>
                    <td data-label="Time">
                      <Time value={entry.at} />
                    </td>
                    <td data-label="Actor">
                      {word(object(entry.actor).name, "System")}
                    </td>
                    <td data-label="Action">{word(entry.action)}</td>
                    <td data-label="Module">
                      <span className="accs-tag">{word(entry.module, "—")}</span>
                    </td>
                    <td data-label="Reference">
                      <span className="accs-mono">
                        {word(entry.reference, "—")}
                      </span>
                    </td>
                    <td data-label="Purpose">
                      <Truncated value={entry.purpose} />
                    </td>
                    <td data-label="Reason">
                      <Truncated value={entry.reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-pager">
            <span>
              {start + 1}–{start + shown.length} of {filtered.length}
            </span>
            <span className="adm-pager__nav">
              <Button
                variant="secondary"
                size="sm"
                icon="arrow-left"
                isDisabled={current === 0}
                onPress={() => setPageIndex(current - 1)}
              >
                Previous
              </Button>
              <span>
                Page {current + 1} of {pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                iconEnd="arrow-right"
                isDisabled={current >= pages - 1}
                onPress={() => setPageIndex(current + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <div className="accs-panel">
          <Empty
            title="No audit entries"
            action={
              filtering ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setQuery("");
                    setModule("All");
                    setActionFilter("All");
                    setFrom("");
                    setTo("");
                    setPageIndex(0);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          >
            {filtering
              ? "No events match these filters."
              : "Events show up here as people use ACCS."}
          </Empty>
        </div>
      )}
    </div>
  );
}

function Truncated({ value }: { value: unknown }) {
  const text = word(value);
  return text ? (
    <span className="adm-trunc" title={text}>
      {text}
    </span>
  ) : (
    <span className="adm-muted">—</span>
  );
}

/* ---------- Screen ---------- */

export function AdminScreen({ pageId }: { pageId: string }) {
  const params = useParams({ strict: false }) as Record<string, string>;
  const recordId = Object.values(params).at(-1);
  const filters = useRouterState({
    select: (state) => state.location.searchStr.slice(1),
  });
  const page = useQuery(
    pageQuery(
      pageId,
      ["P47", "P50"].includes(pageId) ? recordId : undefined,
      filters,
    ),
  );
  const session = useQuery(sessionQuery());
  const roleAllowed =
    session.data?.user.roles.includes("administrator") === true;
  if (session.isPending || page.isPending)
    return (
      <div
        className="adm-skeleton"
        role="status"
        aria-label="Loading administration"
      >
        <div className="accs-skeleton" />
        <div className="accs-skeleton" />
        <div className="accs-skeleton" />
      </div>
    );
  if (!roleAllowed)
    return (
      <ViewState
        kind="restricted"
        title="Your role can't open this page"
      />
    );
  if (page.isError)
    return page.error instanceof ApiError &&
      [403, 404].includes(page.error.status) ? (
      <ViewState
        kind="restricted"
        title="This item isn't available"
        description="It may not exist, or it may be outside your access."
      />
    ) : (
      <ViewState
        kind="error"
        title="This page couldn't load"
        description="Check your connection, then try again."
        actions={
          <Button variant="secondary" onPress={() => void page.refetch()}>
            Try again
          </Button>
        }
      />
    );
  switch (pageId) {
    case "P45":
      return <AdminOverview page={page.data} />;
    case "P46":
      return <UsersPage page={page.data} />;
    case "P47":
      return <UserDetail page={page.data} userId={recordId ?? ""} />;
    case "P48":
      return <PermissionMatrix page={page.data} />;
    case "P49":
      return <ModerationQueue page={page.data} />;
    case "P50":
      return <ModerationReview page={page.data} itemId={recordId ?? ""} />;
    case "P51":
      return <AuditLogPage page={page.data} />;
    default:
      return <SystemMonitoring page={page.data} />;
  }
}
