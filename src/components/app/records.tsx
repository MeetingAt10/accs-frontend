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
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Fragment, useId, useState, type ReactNode } from "react";

import {
  Empty,
  Kpi,
  Kpis,
  PageHeader,
  Panel,
  StatusChip,
  siteCrumb,
  toneFor,
} from "@/components/app/page-shell";
import { BarChart, CountUp, TrendChart } from "@/components/ds-next/charts";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { pageQuery, sessionQuery } from "@/lib/queries";

import "./records.css";

type Item = Record<string, unknown>;

const ease = [0.16, 1, 0.3, 1] as const;

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
const firstRole = (value: unknown, fallback = "Office not recorded") =>
  Array.isArray(value) ? word(value[0], fallback) : fallback;
const features = (restriction: Item) =>
  Array.isArray(restriction.features) ? restriction.features.map(String) : [];
const isPaused = (standing: unknown) =>
  /paused|restrict/i.test(word(standing));
const hasRestrictions = (student: Item) =>
  (Array.isArray(student.restrictions) && student.restrictions.length > 0) ||
  isPaused(student.standing);

/** Counts and percentages count up; anything else renders as text. */
function kpiValue(value: unknown): ReactNode {
  const match = /^(-?\d+(?:\.(\d+))?)(%?)$/.exec(word(value).trim());
  if (!match) return word(value, "—");
  return (
    <CountUp
      value={Number(match[1])}
      decimals={match[2]?.length ?? 0}
      suffix={match[3] ?? ""}
    />
  );
}

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

/* ---------- Shared building blocks ---------- */

function Screen({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="accs-stack">
      {header}
      <div className="accs-stack accs-stagger">{children}</div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rc-note">
      <Icon name="lock" size={16} />
      <span>{children}</span>
    </p>
  );
}

function Facts({
  rows,
  stacked,
}: {
  rows: Array<[string, ReactNode]>;
  stacked?: boolean;
}) {
  return (
    <dl className={"rc-facts" + (stacked ? " rc-facts--stacked" : "")}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rc-filter">
      <span className="rc-filter__label">{label}</span>
      {children}
    </div>
  );
}

/** Segmented control: one option pressed, thumb slides between options. */
function Seg({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  const uid = useId();
  return (
    <div role="group" aria-label={label} className="rc-seg">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="rc-seg__btn"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.id === value && (
            <motion.span
              layoutId={uid}
              className="rc-seg__thumb"
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
            />
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}

type TabDef = { id: string; label: string; count?: number };

function TabBar({
  tabs,
  value,
  onChange,
  label,
  panelId,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  panelId: string;
}) {
  const move = (event: React.KeyboardEvent, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    onChange(target.id);
    document.getElementById(`${panelId}-tab-${target.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="rc-tabs">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${panelId}-tab-${tab.id}`}
          type="button"
          role="tab"
          className="rc-tab"
          aria-selected={tab.id === value}
          aria-controls={panelId}
          tabIndex={tab.id === value ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => move(event, index)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="rc-tab__count">{tab.count}</span>
          )}
          {tab.id === value && (
            <motion.span
              layoutId={panelId}
              className="rc-tab__bar"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function TabBody({
  panelId,
  value,
  children,
}: {
  panelId: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={value}
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${panelId}-tab-${value}`}
        className="rc-tabpanel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
        transition={{ duration: 0.28, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function PersonCell({
  name,
  sub,
  href,
}: {
  name: string;
  sub?: ReactNode;
  href?: string;
}) {
  return (
    <div className="rc-person">
      <span className="accs-avatar" aria-hidden>
        {initials(name) || "?"}
      </span>
      <div>
        {href ? (
          <Link variant="quiet" className="rc-person__name" href={href}>
            {name}
          </Link>
        ) : (
          <span className="rc-person__name">{name}</span>
        )}
        {sub && <p className="rc-person__sub">{sub}</p>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rc-skel" role="status" aria-busy="true">
      <span className="rc-sr">Loading</span>
      <div className="accs-skeleton rc-skel__title" />
      <div className="accs-skeleton rc-skel__line" style={{ width: "40%" }} />
      <div className="accs-skeleton rc-skel__block" />
    </div>
  );
}

/* ---------- Student record parts ---------- */

export function StandingBadge({ standing }: { standing: unknown }) {
  const paused = isPaused(standing);
  return (
    <StatusChip tone={paused ? "warn" : "ok"}>
      {paused ? "Some features paused" : "Good standing"}
    </StatusChip>
  );
}

export function OffenseHistory({ offenses }: { offenses: Item[] }) {
  return (
    <Panel title="Offense history">
      {offenses.length ? (
        <ol className="accs-timeline rc-timeline">
          {offenses.map((offense, index) => (
            <motion.li
              key={word(offense.id, String(index))}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: index * 0.06 }}
            >
              <div className="rc-timeline__head">
                <span className="rc-timeline__title">
                  Level {word(offense.level, "—")}
                </span>
                <StatusChip tone={toneFor(word(offense.status))}>
                  {word(offense.status, "Recorded")}
                </StatusChip>
                <span className="accs-timeline__time">
                  {formatDate(offense.at)}
                </span>
              </div>
              <p className="rc-body">{word(offense.summary)}</p>
              <p className="accs-meta">
                <span>
                  Decision{" "}
                  <span className="accs-mono">
                    {word(offense.decisionReference, "—")}
                  </span>
                </span>
                <span>{word(offense.actorRole, "Office not recorded")}</span>
              </p>
            </motion.li>
          ))}
        </ol>
      ) : (
        <Empty title="No offense records">
          This student has none.
        </Empty>
      )}
    </Panel>
  );
}

export function RestrictionPanel({
  restrictions,
  title = "Restrictions",
}: {
  restrictions: Item[];
  title?: string;
}) {
  const ordered = [...restrictions].sort(
    (left, right) =>
      Number(right.active === true) - Number(left.active === true),
  );
  return (
    <Panel flush title={title}>
      {ordered.length ? (
        <ul className="accs-rows">
          {ordered.map((restriction, index) => (
            <li key={word(restriction.id, String(index))}>
              <div className="accs-row rc-row">
                <div>
                  <p className="accs-row__title">
                    {features(restriction).join(", ") || "Restricted features"}
                  </p>
                  <p className="accs-row__sub">
                    {word(restriction.basis, "No basis given")}
                    {Boolean(restriction.decisionReference) && (
                      <>
                        {" · "}
                        <span className="accs-mono">
                          {word(restriction.decisionReference)}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="accs-row__sub">
                    {firstRole(
                      object(restriction.authorizer).roles,
                      word(restriction.actorRole, "Office not recorded"),
                    )}
                  </p>
                </div>
                <div className="rc-row__aside">
                  <StatusChip tone={restriction.active === true ? "warn" : "neutral"}>
                    {restriction.active === true ? "Active" : "Ended"}
                  </StatusChip>
                  <span className="accs-mono">
                    {formatDate(restriction.starts)} to{" "}
                    {formatDate(restriction.until)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No restrictions">
          This student has no restrictions on record.
        </Empty>
      )}
    </Panel>
  );
}

export function AuditLog({
  entries,
  title = "Recent actions",
}: {
  entries: Item[];
  title?: string;
}) {
  return (
    <Panel
      flush
      title={title}
      action={<span className="accs-mono rc-muted">{entries.length}</span>}
    >
      {entries.length ? (
        <div className="rc-scroll">
          <table className="accs-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Module</th>
                <th scope="col">Reference</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={word(entry.id, String(index))}>
                  <td className="accs-mono">{formatDateTime(entry.at)}</td>
                  <td>{word(object(entry.actor).name, "Unknown user")}</td>
                  <td>{word(entry.action, "—")}</td>
                  <td>{word(entry.module, "—")}</td>
                  <td className="accs-mono">{word(entry.reference, "—")}</td>
                  <td>{word(entry.purpose, "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No entries yet" />
      )}
    </Panel>
  );
}

/* ---------- Similar reports (P23, P24) ---------- */

function Similarity({ value }: { value: unknown }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="rc-sim">
      <div className="rc-sim__head">
        <span>Similarity</span>
        <span className="rc-sim__pct">
          <CountUp value={pct} suffix="%" />
        </span>
      </div>
      <div
        className="rc-sim__track"
        role="meter"
        aria-label="Similarity"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <motion.span
          className="rc-sim__fill"
          style={{ width: `${pct}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease, delay: 0.15 }}
        />
      </div>
    </div>
  );
}

function ClusterRow({ cluster }: { cluster: Item }) {
  const count = Number(
    word(cluster.reportCount, String(items(cluster.reportIds).length)),
  );
  return (
    <li className="rc-cluster">
      <div className="accs-row rc-row rc-row--cluster">
        <div>
          <p className="accs-row__title">
            <Link
              variant="quiet"
              className="rc-cluster__link"
              href={"/cases/clusters/" + encodeURIComponent(word(cluster.id))}
            >
              {word(cluster.title, "Similar reports for review")}
            </Link>
          </p>
          <p className="accs-row__sub">
            {word(cluster.program, "—")} · {count}{" "}
            {count === 1 ? "report" : "reports"}
          </p>
          <p className="rc-muted">{word(cluster.supporting)}</p>
        </div>
        <div className="rc-row__aside rc-cluster__aside">
          <StatusChip tone={toneFor(word(cluster.status, "To review"))}>
            {word(cluster.status, "To review")}
          </StatusChip>
          <Similarity value={cluster.similarity} />
        </div>
      </div>
    </li>
  );
}

function ClusterList({ page }: { page: PageEnvelope }) {
  const clusters = items(page.data.clusters);
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[siteCrumb("/cases"), { label: "Similar reports" }]}
          title="Similar reports"
          description="Suggested matches from your program's reports."
        />
      }
    >
      <Note>
        A person reviews every suggestion. The system never groups reports
        into a case by itself. <span className="tbd-comment">TBD(D-07)</span>
      </Note>
      {clusters.length ? (
        <Panel flush>
          <ul className="accs-rows">
            {clusters.map((cluster) => (
              <ClusterRow key={word(cluster.id)} cluster={cluster} />
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel>
          <Empty title="No groups to review">
            The system has not flagged any similar reports in your program.
          </Empty>
        </Panel>
      )}
    </Screen>
  );
}

function ClusterReview({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const reports = items(page.data.reports);
  const action = useAction("P24");
  const [reason, setReason] = useState("");
  if (!record.id)
    return (
      <ViewState
        kind="restricted"
        title="This group isn't available"
        description="It may not exist, or it may be outside your program."
      />
    );
  const decide = (decision: "confirmed" | "dismissed") =>
    action.mutate({
      action: "reviewCluster",
      recordId: word(record.id),
      payload: { decision },
      reason,
    });
  const phrases = Array.isArray(record.phrases) ? record.phrases.map(String) : [];
  const status = word(record.status, "To review");
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[
            siteCrumb("/cases"),
            { label: "Similar reports", href: "/cases/clusters" },
            { label: word(record.id) },
          ]}
          title={word(record.title, "Review a similar-report group")}
          description={`${word(record.program)} · ${word(record.similarity)}% similarity`}
          actions={
            <StatusChip tone={toneFor(status)}>{status}</StatusChip>
          }
        />
      }
    >
      <div className="rc-cols rc-cols--wide">
        <div className="accs-stack">
          <Panel title="What the reports share">
            <Facts
              stacked
              rows={[
                ["Supporting summary", word(record.supporting, "—")],
                ["Different details", word(record.dissenting, "—")],
                [
                  "Repeated phrases",
                  phrases.length ? (
                    <span className="rc-tags">
                      {phrases.map((phrase) => (
                        <span className="accs-tag" key={phrase}>
                          {phrase}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  ),
                ],
              ]}
            />
          </Panel>
          <Panel
            flush
            title="Reports in this group"
            action={
              <span className="accs-mono rc-muted">{reports.length}</span>
            }
          >
            {reports.length ? (
              <ul className="accs-rows">
                {reports.map((report, index) => (
                  <li key={word(report.id, String(index))}>
                    <div className="accs-row rc-row">
                      <div>
                        <div className="rc-row__line">
                          <Link
                            variant="quiet"
                            className="rc-ref accs-mono"
                            href={"/cases/" + encodeURIComponent(word(report.id))}
                          >
                            {word(report.id)}
                          </Link>
                          <StatusChip tone={toneFor(word(report.status))}>
                            {word(report.status, "—")}
                          </StatusChip>
                        </div>
                        <p className="rc-body">
                          {word(
                            report.summary,
                            "Open the case to read this report.",
                          )}
                        </p>
                      </div>
                      <div className="rc-row__aside">
                        <Link
                          variant="quiet"
                          href={"/cases/" + encodeURIComponent(word(report.id))}
                        >
                          Open case
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No reports available" />
            )}
          </Panel>
        </div>
        <Panel title="Your review">
          <Similarity value={record.similarity} />
          <p className="rc-muted">
            A high score does not mean the reports describe the same event.
            Read each report in context.
          </p>
          {status === "To review" ? (
            <div className="rc-reasons">
              <TextArea
                label="Review note"
                value={reason}
                onChange={setReason}
                maxLength={1000}
                description="Say why you are confirming or dismissing this group."
              />
              {action.error && (
                <Alert tone="danger" title="The review wasn't saved">
                  {action.error.message}
                </Alert>
              )}
              <div className="rc-actions-row">
                <Button
                  loading={action.isPending}
                  isDisabled={!reason.trim()}
                  onPress={() => decide("confirmed")}
                >
                  Confirm group
                </Button>
                <Button
                  variant="secondary"
                  loading={action.isPending}
                  isDisabled={!reason.trim()}
                  onPress={() => decide("dismissed")}
                >
                  Dismiss suggestion
                </Button>
              </div>
            </div>
          ) : (
            <p className="rc-muted">This group has been reviewed and is {status}.</p>
          )}
        </Panel>
      </div>
    </Screen>
  );
}

/* ---------- Analytics ---------- */

const stages = ["adviser", "chair", "dean", "guidance", "osas", "executive"];
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Analytics({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const session = useQuery(sessionQuery());
  const search = new URLSearchParams(location.searchStr);
  const stats = items(page.data.stats);
  const stageRows = items(page.data.byStage);
  const categories = items(page.data.byCategory);
  const trend = items(page.data.trend);
  const cases = items(page.data.cases);
  const updateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(location.searchStr);
    if (value) next.set(name, value);
    else next.delete(name);
    router.history.replace(
      location.pathname + (next.size ? "?" + next.toString() : ""),
    );
  };
  const filtered = [...search.keys()].length > 0;
  const program = search.get("program") ?? "All";
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[siteCrumb("/analytics"), { label: "Case analytics" }]}
          title="Case analytics"
          description="Case counts for the programs you can see."
          actions={
            filtered ? (
              <Button
                variant="secondary"
                onPress={() => router.history.replace(location.pathname)}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      }
    >
      <div className="accs-toolbar rc-toolbar rc-toolbar--fields" role="search">
        <div className="accs-grow">
          <Search
            label="Search by case reference"
            placeholder="Case reference"
            size="sm"
            value={search.get("q") ?? ""}
            onChange={(value) => updateFilter("q", value)}
          />
        </div>
        {session.data?.user.roles.includes("dean") && (
          <FilterField label="Program">
            <Seg
              label="Program"
              value={program}
              onChange={(id) => updateFilter("program", id === "All" ? "" : id)}
              options={[
                { id: "All", label: "All" },
                { id: "BSIT", label: "BSIT" },
                { id: "BSCS", label: "BSCS" },
              ]}
            />
          </FilterField>
        )}
        <Select
          label="Stage"
          selectedKey={search.get("stage") ?? "All"}
          onSelectionChange={(key) =>
            updateFilter("stage", String(key) === "All" ? "" : String(key))
          }
        >
          <SelectOption id="All">All stages</SelectOption>
          {stages.map((stage) => (
            <SelectOption key={stage} id={stage}>
              {cap(stage)}
            </SelectOption>
          ))}
        </Select>
        <Select
          label="Category"
          selectedKey={search.get("category") ?? "All"}
          onSelectionChange={(key) =>
            updateFilter("category", String(key) === "All" ? "" : String(key))
          }
        >
          <SelectOption id="All">All categories</SelectOption>
          {[
            "General concern",
            "Academic process",
            "Facilities",
            "Communication",
          ].map((category) => (
            <SelectOption key={category} id={category}>
              {category}
            </SelectOption>
          ))}
        </Select>
        <Select
          label="Period"
          selectedKey={search.get("period") ?? "current"}
          onSelectionChange={(key) =>
            updateFilter("period", String(key) === "current" ? "" : String(key))
          }
        >
          <SelectOption id="current">Available period</SelectOption>
          <SelectOption id="none">No matching period</SelectOption>
        </Select>
        <TextField
          type="date"
          label="From"
          value={search.get("from") ?? ""}
          onChange={(value) => updateFilter("from", value)}
        />
        <TextField
          type="date"
          label="To"
          value={search.get("to") ?? ""}
          onChange={(value) => updateFilter("to", value)}
        />
      </div>
      <Kpis label="Case counts">
        {stats.map((stat) => (
          <Kpi
            key={word(stat.label)}
            label={word(stat.label)}
            value={kpiValue(stat.value)}
            note={word(stat.note) || undefined}
          />
        ))}
      </Kpis>
      <div className="rc-cols">
        <Panel title="Cases by stage">
          <BarChart
            title="Cases by stage"
            hideTitle
            data={stageRows.map((row) => ({
              label: word(row.label),
              value: Number(row.value ?? 0),
            }))}
          />
        </Panel>
        <Panel title="Category counts">
          <BarChart
            title="Category counts"
            hideTitle
            data={categories.map((row) => ({
              label: word(row.label),
              value: typeof row.value === "number" ? row.value : null,
              suppressed: row.suppressed === true,
            }))}
          />
          <p className="rc-policy">
            Categories with too few cases show as suppressed.
          </p>
        </Panel>
        <Panel title="Opened and resolved reports" className="rc-span">
          <TrendChart
            title="Opened and resolved reports"
            hideTitle
            data={trend.map((row) => ({
              label: word(row.label),
              opened: Number(row.opened ?? 0),
              resolved: Number(row.resolved ?? 0),
            }))}
            series={[
              { key: "opened", label: "Opened" },
              { key: "resolved", label: "Resolved" },
            ]}
          />
        </Panel>
      </div>
      <Panel
        flush
        title="Cases in this view"
        action={<span className="accs-mono rc-muted">{cases.length}</span>}
      >
        {cases.length ? (
          <div className="rc-scroll">
            <table className="accs-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Status</th>
                  <th scope="col">Opened</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((entry) => (
                  <tr key={word(entry.id)}>
                    <td>
                      <Link
                        variant="quiet"
                        className="rc-ref accs-mono"
                        href={"/cases/" + encodeURIComponent(word(entry.id))}
                      >
                        {word(entry.id)}
                      </Link>
                    </td>
                    <td>
                      {cap(word(entry.stage, "—"))}
                    </td>
                    <td>
                      <StatusChip tone={toneFor(word(entry.status))}>
                        {word(entry.status, "—")}
                      </StatusChip>
                    </td>
                    <td className="accs-mono">{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No cases match these filters">
            Change or clear a filter.
          </Empty>
        )}
      </Panel>
      <Note>
        This page shows counts only. It never shows what a report says.
      </Note>
    </Screen>
  );
}

/* ---------- Records list (P33) ---------- */

function RecordList({ page }: { page: PageEnvelope }) {
  const students = items(page.data.students);
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("All");
  const [standing, setStanding] = useState("All");
  const [restricted, setRestricted] = useState(false);
  const session = useQuery(sessionQuery());
  const role = session.data?.user.roles[0];
  const scope =
    role === "chair"
      ? `${word(session.data?.user.program)} program`
      : role === "dean"
        ? "CCS students"
        : role === "guidance"
          ? "Students in Guidance cases"
          : "Students under OSAS authority";
  const programs = [
    ...new Set(students.map((student) => word(student.program)).filter(Boolean)),
  ].sort();
  const needle = search.trim().toLowerCase();
  const matching = students.filter(
    (student) =>
      `${word(student.name)} ${word(student.studentId)} ${word(student.program)} ${word(student.section)}`
        .toLowerCase()
        .includes(needle) &&
      (program === "All" || word(student.program) === program) &&
      (standing === "All" ||
        (standing === "Restricted"
          ? isPaused(student.standing)
          : !isPaused(student.standing))) &&
      (!restricted || hasRestrictions(student)),
  );
  const filtered = Boolean(needle) || program !== "All" || standing !== "All" || restricted;
  const reset = () => {
    setSearch("");
    setProgram("All");
    setStanding("All");
    setRestricted(false);
  };
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[siteCrumb("/records"), { label: "Student records" }]}
          title="Student records"
          description={scope}
        />
      }
    >
      <Note>
        Opening a record asks for a reason and logs it with your name and the
        time. Browsing this list is not logged.
      </Note>
      <div className="accs-toolbar rc-toolbar" role="search">
        <div className="accs-grow">
          <Search
            label="Search by name or student ID"
            placeholder="Search name or student ID"
            size="sm"
            value={search}
            onChange={setSearch}
          />
        </div>
        {programs.length > 1 && (
          <FilterField label="Program">
            <Seg
              label="Program"
              value={program}
              onChange={setProgram}
              options={[
                { id: "All", label: "All" },
                ...programs.map((entry) => ({ id: entry, label: entry })),
              ]}
            />
          </FilterField>
        )}
        <FilterField label="Standing">
          <Seg
            label="Standing"
            value={standing}
            onChange={setStanding}
            options={[
              { id: "All", label: "All" },
              { id: "Good", label: "Good standing" },
              { id: "Restricted", label: "Features paused" },
            ]}
          />
        </FilterField>
        <button
          type="button"
          className="accs-pill"
          aria-pressed={restricted}
          onClick={() => setRestricted((value) => !value)}
        >
          Has restriction
        </button>
      </div>
      <p className="rc-count" aria-live="polite">
        {matching.length} of {students.length}{" "}
        {students.length === 1 ? "student" : "students"}
      </p>
      {matching.length ? (
        <div className="accs-table-wrap rc-table-wrap">
          <table className="accs-table rc-table">
            <caption className="rc-sr">Student records</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Student ID</th>
                <th scope="col">Program</th>
                <th scope="col">Standing</th>
                <th scope="col" className="accs-num">
                  Restrictions
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial>
                {matching.map((student, index) => {
                  const count = Array.isArray(student.restrictions)
                    ? student.restrictions.length
                    : undefined;
                  return (
                    <motion.tr
                      key={word(student.id)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.28,
                          ease,
                          delay: Math.min(index, 8) * 0.03,
                        },
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      <td>
                        <PersonCell
                          name={word(student.name, "—")}
                          href={"/records/" + encodeURIComponent(word(student.id))}
                        />
                      </td>
                      <td className="accs-mono">{word(student.studentId, "—")}</td>
                      <td>
                        <span className="rc-tags">
                          <span className="accs-tag">{word(student.program, "—")}</span>
                          <span className="rc-muted">Section {word(student.section, "—")}</span>
                        </span>
                      </td>
                      <td>
                        {isPaused(student.standing) ? (
                          <StandingBadge standing={student.standing} />
                        ) : (
                          <span className="rc-muted">Good standing</span>
                        )}
                      </td>
                      <td className="accs-num">
                        {count ? (
                          count
                        ) : hasRestrictions(student) ? (
                          <StatusChip tone="warn">Active</StatusChip>
                        ) : (
                          <span className="rc-muted">None</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        <Panel>
          <Empty
            title={filtered ? "No students match" : "No students to show"}
            action={
              filtered ? (
                <Button variant="secondary" onPress={reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
          >
            {filtered ? "Change the search or clear a filter." : undefined}
          </Empty>
        </Panel>
      )}
    </Screen>
  );
}

/* ---------- Student record (P34) ---------- */

const purposes = [
  ["Case handling", "Reviewing a report or decision about this student."],
  ["Good Moral review", "Checking prerequisites for a certificate request."],
  ["Restriction review", "Applying, lifting, or checking a restriction."],
  ["Program oversight", "Routine program or college review."],
] as const;

function PurposeStep({
  openRecord,
  onCancel,
}: {
  openRecord: (purpose: string, note: string) => void;
  onCancel: () => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[
            siteCrumb("/records"),
            { label: "Student records", href: "/records" },
            { label: "Open record" },
          ]}
          title="Open this student record"
          description="The reason you pick is logged with your name and the time."
        />
      }
    >
      <Panel title="Purpose of access">
        <fieldset className="rc-choices">
          <legend className="rc-sr">Why do you need this record?</legend>
          {purposes.map(([title, sub]) => (
            <label className="rc-choice" key={title}>
              <input
                type="radio"
                name="purpose"
                className="rc-sr"
                value={title}
                checked={purpose === title}
                onChange={() => setPurpose(title)}
              />
              <span className="rc-choice__title">{title}</span>
              <span className="rc-choice__sub">{sub}</span>
              <span className="rc-choice__check" aria-hidden>
                <Icon name="check" size={16} />
              </span>
            </label>
          ))}
        </fieldset>
        <TextArea
          label="Note (optional)"
          value={note}
          onChange={setNote}
          maxLength={500}
        />
        <div className="rc-actions-row">
          <Button isDisabled={!purpose} onPress={() => openRecord(purpose, note)}>
            Open record
          </Button>
          <Button variant="secondary" onPress={onCancel}>
            Cancel
          </Button>
        </div>
      </Panel>
    </Screen>
  );
}

function GoodMoralReview({
  studentId,
  review,
}: {
  studentId: string;
  review: Item;
}) {
  const action = useAction("P34");
  const [status, setStatus] = useState(word(review.status, ""));
  const [source, setSource] = useState(word(review.decisionSource));
  const [notes, setNotes] = useState(word(review.notes));
  return (
    <div className="rc-cols">
      <Panel title="Prerequisite review">
        <Select
          label="Prerequisite status"
          selectedKey={status || null}
          onSelectionChange={(key) => setStatus(String(key))}
        >
          <SelectOption id="Pending QCU review">Pending QCU review</SelectOption>
          <SelectOption id="Prerequisites reviewed">
            Prerequisites reviewed
          </SelectOption>
          <SelectOption id="Further review needed">
            Further review needed
          </SelectOption>
        </Select>
        <TextField
          label="Decision source"
          isRequired
          value={source}
          onChange={setSource}
        />
        <TextArea
          label="Notes"
          value={notes}
          onChange={setNotes}
          maxLength={2000}
        />
        {action.error && (
          <Alert tone="danger" title="The review wasn't saved">
            {action.error.message}
          </Alert>
        )}
        <div className="rc-actions-row">
          <Button
            loading={action.isPending}
            isDisabled={!status || !source.trim()}
            onPress={() =>
              action.mutate({
                action: "reviewGoodMoral",
                recordId: studentId,
                payload: { status, decisionSource: source, notes },
                reason: source,
              })
            }
          >
            Save review
          </Button>
        </div>
        <p className="rc-policy">
          Certificate rules need QCU approval. This page records a prerequisite
          review. It does not issue a certificate or apply a penalty.{" "}
          <span className="tbd-comment">TBD(D-02)</span>
        </p>
      </Panel>
      <Panel title="Last review">
        {review.status ? (
          <Facts
            rows={[
              ["Status", word(review.status)],
              ["Decision source", word(review.decisionSource, "—")],
              ["Recorded", formatDate(review.at)],
              ["Reviewer role", word(review.actorRole, "Authorized office")],
            ]}
          />
        ) : (
          <Empty title="No review yet">
            Save a review to record the prerequisite status.
          </Empty>
        )}
      </Panel>
    </div>
  );
}

function StudentRecord({
  page,
  studentId,
}: {
  page: PageEnvelope;
  studentId: string;
}) {
  const router = useRouter();
  const panelId = useId();
  const location = useRouterState({ select: (state) => state.location });
  const queryParams = new URLSearchParams(location.searchStr);
  const opened = queryParams.has("purpose") && Boolean(page.data.record);
  const record = object(page.data.record);
  const offenses = items(record.offenses);
  const restrictions = items(record.restrictions);
  const activeRestrictions = restrictions.filter(
    (restriction) => restriction.active === true,
  );
  const session = useQuery(sessionQuery());
  const roles = session.data?.user.roles ?? [];
  const canGoodMoral = roles.some(
    (role) => role === "guidance" || role === "osas",
  );
  const accessHistory = Array.isArray(record.accessHistory)
    ? items(record.accessHistory)
    : undefined;
  const tabs: TabDef[] = [
    { id: "overview", label: "Overview" },
    { id: "offenses", label: "Offenses", count: offenses.length },
    { id: "restrictions", label: "Restrictions", count: activeRestrictions.length },
    ...(canGoodMoral ? [{ id: "good-moral", label: "Good Moral" }] : []),
    ...(accessHistory
      ? [{ id: "access-log", label: "Access log", count: accessHistory.length }]
      : []),
  ];
  const requestedTab = queryParams.get("tab") ?? "overview";
  const selectedTab = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "overview";
  const openRecord = (purpose: string, note: string) => {
    queryParams.set("purpose", purpose);
    if (note.trim()) queryParams.set("note", note.trim());
    router.history.replace(location.pathname + "?" + queryParams.toString());
  };
  const selectTab = (key: string) => {
    const next = new URLSearchParams(location.searchStr);
    if (key === "overview") next.delete("tab");
    else next.set("tab", key);
    router.history.replace(
      location.pathname + (next.size ? "?" + next.toString() : ""),
    );
  };
  if (!opened)
    return (
      <PurposeStep
        openRecord={openRecord}
        onCancel={() => router.history.push("/records")}
      />
    );
  if (!record.id)
    return (
      <ViewState
        kind="restricted"
        title="This record isn't available to you"
        description="It may not exist, or it may be outside your scope."
      />
    );
  const name = word(record.name, "Student");
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[
            siteCrumb("/records"),
            { label: "Student records", href: "/records" },
            { label: word(record.studentId, name) },
          ]}
          title={
            <span className="rc-title">
              <span className="accs-avatar rc-avatar--lg" aria-hidden>
                {initials(name)}
              </span>
              {name}
            </span>
          }
          description={
            <span className="accs-meta">
              <span className="accs-mono">{word(record.studentId, "—")}</span>
              <span className="accs-tag">{word(record.program, "—")}</span>
              <span>Section {word(record.section, "—")}</span>
              <span>Year {word(record.year, "—")}</span>
            </span>
          }
          actions={
            <>
              <StandingBadge standing={record.standing} />
              {activeRestrictions.length > 0 && (
                <StatusChip tone="warn">Restriction active</StatusChip>
              )}
            </>
          }
        />
      }
    >
      <p className="rc-count">
        Opened {formatDateTime(record.openedAt)}. Logged with your name.
      </p>
      <div className="accs-stack accs-stack--tight">
        <TabBar
          label="Student record sections"
          panelId={panelId}
          tabs={tabs}
          value={selectedTab}
          onChange={selectTab}
        />
        <TabBody panelId={panelId} value={selectedTab}>
          {selectedTab === "overview" && (
            <div className="rc-cols rc-cols--wide">
              <RestrictionPanel
                title="Active restrictions"
                restrictions={activeRestrictions}
              />
              <Panel title="Student">
                <Facts
                  rows={[
                    ["Program", word(record.program, "—")],
                    ["Section", word(record.section, "—")],
                    ["Year", word(record.year, "—")],
                    ["Standing", <StandingBadge standing={record.standing} />],
                  ]}
                />
              </Panel>
            </div>
          )}
          {selectedTab === "offenses" && <OffenseHistory offenses={offenses} />}
          {selectedTab === "restrictions" && (
            <>
              <RestrictionPanel restrictions={restrictions} />
              <Note>
                Announcements, academic information, the assistant, and
                permitted professor messages stay available.
              </Note>
              {(roles.includes("guidance") || roles.includes("osas")) && (
                <RecordRestrictionActions
                  restrictions={restrictions}
                  osas={roles.includes("osas")}
                />
              )}
            </>
          )}
          {selectedTab === "good-moral" && (
            <GoodMoralReview
              studentId={studentId}
              review={object(record.goodMoral)}
            />
          )}
          {selectedTab === "access-log" && accessHistory && (
            <AuditLog entries={accessHistory} title="Access log" />
          )}
        </TabBody>
      </div>
    </Screen>
  );
}

/* ---------- Restrictions (P35) ---------- */

function RestrictionManagement({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const panelId = useId();
  const userRoles = session.data?.user.roles ?? [];
  const admin = userRoles.includes("administrator");
  const action = useAction("P35");
  const students = items(page.data.students);
  const restrictions = items(page.data.restrictions);
  const referrals = items(page.data.referrals);
  const [tab, setTab] = useState("active");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [decisionReference, setDecisionReference] = useState("");
  const [basis, setBasis] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const active = restrictions.filter((restriction) => restriction.active === true);
  const ended = restrictions.filter((restriction) => restriction.active !== true);
  const submitApply = () =>
    action.mutate(
      {
        action: "applyRestriction",
        payload: {
          studentId: selectedStudent,
          features: selectedFeatures,
          decisionReference,
          basis,
          until,
        },
        reason: reason || basis,
      },
      {
        onSuccess: () => {
          setApplyOpen(false);
          setReason("");
        },
      },
    );
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[siteCrumb("/restrictions"), { label: "Restrictions" }]}
          title="Restrictions"
          description={
            admin
              ? "All students"
              : userRoles.includes("guidance")
                ? "Students in Guidance cases"
                : "Students under OSAS authority"
          }
          actions={
            admin ? (
              <Button onPress={() => setApplyOpen(true)}>Apply restriction</Button>
            ) : undefined
          }
        />
      }
    >
      <Note>
        A restriction pauses only the features it lists. Announcements,
        academic information, the assistant, and permitted professor messages
        stay available.
      </Note>
      <div className="accs-stack accs-stack--tight">
        <TabBar
          label="Restriction views"
          panelId={panelId}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "active", label: "Active", count: active.length },
            { id: "requests", label: "Change requests", count: referrals.length },
            { id: "ended", label: "Ended", count: ended.length },
          ]}
        />
        <TabBody panelId={panelId} value={tab}>
          {tab === "requests" ? (
            referrals.length ? (
              <>
                <div className="accs-table-wrap rc-table-wrap">
                  <table className="accs-table rc-table">
                    <caption className="rc-sr">Change requests</caption>
                    <thead>
                      <tr>
                        <th scope="col">Student</th>
                        <th scope="col">Request</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Status</th>
                        <th scope="col">Requested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((request, index) => (
                        <tr key={word(request.id, String(index))}>
                          <td>
                            <PersonCell
                              name={word(object(request.student).name, "—")}
                            />
                          </td>
                          <td>
                            {word(request.change, "—")}
                          </td>
                          <td className="rc-wrap">{word(request.reason, "—")}</td>
                          <td>
                            <StatusChip tone={toneFor(word(request.status))}>
                              {word(request.status, "—")}
                            </StatusChip>
                          </td>
                          <td>
                            <span className="accs-mono">
                              {formatDate(request.at)}
                            </span>
                            <p className="rc-person__sub">
                              {word(object(request.actor).name)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {admin && (
                  <p className="rc-policy">
                    Current policy does not say how to apply an end-date change or
                    decline a request.{" "}
                    <span className="tbd-comment">TBD(D-05)</span>
                  </p>
                )}
              </>
            ) : (
              <Panel>
                <Empty title="No change requests">
                  Guidance and OSAS requests to change a restriction show up here.
                </Empty>
              </Panel>
            )
          ) : (
            <RestrictionRows
              rows={tab === "ended" ? ended : active}
              onLift={setConfirmId}
            />
          )}
        </TabBody>
      </div>
      {action.error && (
        <Alert tone="danger" title="The change wasn't saved">
          {action.error.message}
        </Alert>
      )}
      <Modal
        title="Apply restriction"
        isOpen={applyOpen}
        onOpenChange={setApplyOpen}
      >
        <ModalBody>
          <Select
            label="Student"
            selectedKey={selectedStudent || null}
            onSelectionChange={(key) => setSelectedStudent(String(key))}
          >
            {students.map((student) => (
              <SelectOption key={word(student.id)} id={word(student.id)}>
                {word(student.name)} · {word(student.studentId)}
              </SelectOption>
            ))}
          </Select>
          <CheckboxGroup
            label="Features"
            value={selectedFeatures}
            onChange={setSelectedFeatures}
          >
            <Checkbox value="post.create">Posting</Checkbox>
            <Checkbox value="post.comment">Commenting</Checkbox>
            <Checkbox value="report.anonymous">Anonymous reporting</Checkbox>
          </CheckboxGroup>
          <TextField
            label="Decision reference"
            isRequired
            value={decisionReference}
            onChange={setDecisionReference}
          />
          <TextArea
            label="Basis (policy options TBD)"
            isRequired
            value={basis}
            onChange={setBasis}
            maxLength={500}
          />
          <TextField
            type="date"
            label="End date"
            isRequired
            value={until}
            onChange={setUntil}
          />
          <p className="rc-policy">
            Only the selected features are paused. The restriction starts today.{" "}
            {basis ? "" : "Basis options are still under review. "}
            <span className="tbd-comment">TBD(D-05)</span>
          </p>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setApplyOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={action.isPending}
            isDisabled={
              !selectedStudent ||
              !selectedFeatures.length ||
              !decisionReference.trim() ||
              !basis.trim() ||
              !until
            }
            onPress={submitApply}
          >
            Apply
          </Button>
        </ModalActions>
      </Modal>
      <Modal
        role="alertdialog"
        title="Lift this restriction?"
        isOpen={Boolean(confirmId)}
        onOpenChange={(open) => {
          if (!open) setConfirmId("");
        }}
      >
        <ModalBody>
          <p>
            The student can use the listed features again. This step is logged,
            and a new restriction can be applied later.
          </p>
          <TextArea
            label="Reason"
            isRequired
            value={reason}
            onChange={setReason}
            maxLength={500}
          />
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setConfirmId("")}>
            Cancel
          </Button>
          <Button
            loading={action.isPending}
            isDisabled={!reason.trim()}
            onPress={() =>
              action.mutate(
                {
                  action: "liftRestriction",
                  recordId: confirmId,
                  payload: {},
                  reason,
                },
                {
                  onSuccess: () => {
                    setConfirmId("");
                    setReason("");
                  },
                },
              )
            }
          >
            Lift restriction
          </Button>
        </ModalActions>
      </Modal>
    </Screen>
  );
}

function RestrictionRows({
  rows,
  onLift,
}: {
  rows: Item[];
  onLift: (id: string) => void;
}) {
  const session = useQuery(sessionQuery());
  const roles = session.data?.user.roles ?? [];
  const canRefer = roles.includes("guidance") || roles.includes("osas");
  const [requestId, setRequestId] = useState("");
  if (!rows.length)
    return (
      <Panel>
        <Empty title="No restrictions in this view">
          Nothing to show under this tab.
        </Empty>
      </Panel>
    );
  return (
    <div className="accs-table-wrap rc-table-wrap">
      <table className="accs-table rc-table">
        <caption className="rc-sr">Restrictions</caption>
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Paused features</th>
            <th scope="col">Basis</th>
            <th scope="col">Period</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="rc-sr">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((restriction, index) => {
            const id = word(restriction.id, String(index));
            const isActive = Boolean(restriction.active);
            return (
              <Fragment key={id}>
                <tr>
                  <td>
                    <PersonCell
                      name={word(object(restriction.student).name, "—")}
                      sub={firstRole(object(restriction.authorizer).roles)}
                    />
                  </td>
                  <td>{features(restriction).join(", ") || "—"}</td>
                  <td className="rc-wrap">
                    {word(restriction.basis, "—")}
                    <p className="rc-person__sub accs-mono">
                      {word(restriction.decisionReference, "—")}
                    </p>
                  </td>
                  <td className="accs-mono">
                    {formatDate(restriction.starts)} to{" "}
                    {formatDate(restriction.until)}
                  </td>
                  <td>
                    <StatusChip tone={isActive ? "warn" : "neutral"}>
                      {isActive ? "Active" : "Ended"}
                    </StatusChip>
                  </td>
                  <td className="rc-actions">
                    {isActive && roles.includes("administrator") && (
                      <Button
                        variant="secondary"
                        onPress={() => onLift(word(restriction.id))}
                      >
                        Lift restriction
                      </Button>
                    )}
                    {isActive && canRefer && (
                      <Button
                        variant="secondary"
                        onPress={() =>
                          setRequestId(requestId === id ? "" : id)
                        }
                      >
                        Request change
                      </Button>
                    )}
                  </td>
                </tr>
                {requestId === id && (
                  <tr className="rc-form-row">
                    <td colSpan={6}>
                      <motion.div
                        className="rc-expand"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.32, ease }}
                      >
                        <RestrictionRequestForm
                          restriction={restriction}
                          onClose={() => setRequestId("")}
                        />
                      </motion.div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RestrictionRequestForm({
  restriction,
  onClose,
  pageId = "P35",
  osas = false,
}: {
  restriction: Item;
  onClose: () => void;
  pageId?: string;
  osas?: boolean;
}) {
  const action = useAction(pageId);
  const [change, setChange] = useState("Lift");
  const [reason, setReason] = useState("");
  const [decisionReference, setDecisionReference] = useState("");
  return (
    <div className="rc-form">
      <Select
        label={osas ? "Decision or requested change" : "Requested change"}
        selectedKey={change}
        onSelectionChange={(key) => setChange(String(key))}
      >
        <SelectOption id="Lift">Lift</SelectOption>
        <SelectOption id="Shorten">Shorten</SelectOption>
        <SelectOption id="Extend">Extend</SelectOption>
        {osas && <SelectOption id="Review">Review or refer</SelectOption>}
      </Select>
      {osas && (
        <TextField
          label="Decision reference"
          isRequired
          value={decisionReference}
          onChange={setDecisionReference}
        />
      )}
      <TextArea label="Reason" isRequired value={reason} onChange={setReason} />
      {action.error && (
        <Alert tone="danger" title="The request wasn't saved">
          {action.error.message}
        </Alert>
      )}
      <div className="rc-form__actions">
        <Button
          isDisabled={!reason.trim() || (osas && !decisionReference.trim())}
          loading={action.isPending}
          onPress={() =>
            action.mutate(
              {
                action: "referRestriction",
                recordId: word(restriction.id),
                payload: {
                  studentId: word(restriction.studentId),
                  change,
                  ...(decisionReference ? { decisionReference } : {}),
                },
                reason,
              },
              { onSuccess: onClose },
            )
          }
        >
          {osas ? "Record referral" : "Send request"}
        </Button>
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RecordRestrictionActions({
  restrictions,
  osas,
}: {
  restrictions: Item[];
  osas: boolean;
}) {
  const [requestId, setRequestId] = useState("");
  const active = restrictions.filter(
    (restriction) => restriction.active === true,
  );
  if (!active.length) return null;
  return (
    <Panel flush title="Restriction requests">
      <ul className="accs-rows">
        {active.map((restriction, index) => {
          const id = word(restriction.id, String(index));
          return (
            <li key={id}>
              <div className="accs-row rc-row">
                <div>
                  <p className="accs-row__title">
                    {features(restriction).join(", ") || "Selected features"}
                  </p>
                  <p className="accs-row__sub">
                    Until {formatDate(restriction.until)} ·{" "}
                    <span className="accs-mono">
                      {word(restriction.decisionReference, "—")}
                    </span>
                  </p>
                </div>
                <div className="rc-row__aside">
                  <Button
                    variant="secondary"
                    onPress={() => setRequestId(requestId === id ? "" : id)}
                  >
                    {osas ? "Record decision or referral" : "Request change"}
                  </Button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {requestId === id && (
                  <motion.div
                    className="rc-expand"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease }}
                  >
                    <RestrictionRequestForm
                      restriction={restriction}
                      onClose={() => setRequestId("")}
                      pageId="P34"
                      osas={osas}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      {osas && (
        <p className="rc-policy rc-policy--pad">
          OSAS authority is still being defined. A request records a referral.
          It does not apply or lift a restriction.{" "}
          <span className="tbd-comment">TBD(OSAS-03)</span>
        </p>
      )}
    </Panel>
  );
}

/* ---------- My standing (student) ---------- */

function StandingPage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const restrictions = items(record.restrictions);
  const good = record.standing === "Good standing";
  return (
    <Screen
      header={
        <PageHeader
          crumbs={[siteCrumb("/standing"), { label: "Account standing" }]}
          title="My account standing"
          description={
            good
              ? "All features are available."
              : "Some features are paused for a limited time."
          }
          actions={<StandingBadge standing={record.standing} />}
        />
      }
    >
      {restrictions.length > 0 && (
        <>
          <Panel flush title="Paused features">
            <ul className="accs-rows">
              {restrictions.map((restriction, index) => (
                <li key={word(restriction.id, String(index))}>
                  <div className="accs-row rc-row">
                    <p className="accs-row__title">
                      {features(restriction).join(", ") || "Selected feature"}
                    </p>
                    <div className="rc-row__aside">
                      <span className="accs-mono">
                        Until {formatDate(restriction.until)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel flush title="Still available to you">
            <ul className="accs-rows">
              {[
                ["/feed", "Announcements"],
                ["/spaces", "Classes and academic information"],
                ["/assistant", "Assistant"],
                ["/messages", "Messages with your professors"],
              ].map(([href, label]) => (
                <li key={href}>
                  <div className="accs-row rc-row">
                    <Link variant="quiet" href={href}>
                      {label}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
      <Note>
        Classmates see only a neutral badge. Your profile never shows offense
        details.
      </Note>
      <p>
        <Link variant="standalone" href="/directory?q=Guidance">
          Contact the Guidance Office
        </Link>
      </p>
    </Screen>
  );
}

export function OversightScreen({ pageId }: { pageId: string }) {
  const params = useParams({ strict: false }) as Record<string, string>;
  const recordId = Object.values(params).at(-1);
  const filters = useRouterState({
    select: (state) => {
      const search = new URLSearchParams(state.location.searchStr);
      if (pageId === "P34") search.delete("tab");
      return search.toString();
    },
  });
  const page = useQuery(
    pageQuery(
      pageId,
      ["P24", "P34"].includes(pageId) ? recordId : undefined,
      filters,
    ),
  );
  if (page.isPending) return <Skeleton />;
  if (page.isError)
    return page.error instanceof ApiError &&
      [403, 404].includes(page.error.status) ? (
      <ViewState
        kind="restricted"
        title="This record isn't available to you"
        description="It may not exist, or it may be outside your scope."
      />
    ) : (
      <ViewState
        kind="error"
        title="This page didn't load"
        description="Check your connection, then try again."
        actions={
          <Button variant="secondary" onPress={() => void page.refetch()}>
            Try again
          </Button>
        }
      />
    );
  const screen =
    pageId === "P23" ? (
      <ClusterList page={page.data} />
    ) : pageId === "P24" ? (
      <ClusterReview page={page.data} />
    ) : pageId === "P25" ? (
      <Analytics page={page.data} />
    ) : pageId === "P33" ? (
      <RecordList page={page.data} />
    ) : pageId === "P34" ? (
      <StudentRecord page={page.data} studentId={recordId ?? ""} />
    ) : pageId === "P35" ? (
      <RestrictionManagement page={page.data} />
    ) : (
      <StandingPage page={page.data} />
    );
  return <MotionConfig reducedMotion="user">{screen}</MotionConfig>;
}
