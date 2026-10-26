import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardMeta,
  CardTitle,
  Checkbox,
  CheckboxGroup,
  EmptyState,
  Grid,
  Link,
  Modal,
  ModalActions,
  ModalBody,
  PrivacyNotice,
  Row,
  SectionHeader,
  Select,
  SelectOption,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextArea,
  TextField,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { BarChart, FilterBar, Stat, TrendChart } from "@/components/ds-next";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageQuery, sessionQuery } from "@/lib/queries";

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
const firstRole = (value: unknown, fallback = "Authorized office") =>
  Array.isArray(value) ? word(value[0], fallback) : fallback;
const shortDate = (value: unknown) => {
  const date = new Date(word(value));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", { dateStyle: "medium" });
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

function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <SectionHeader
      level={1}
      split
      title={title}
      description={description}
      actions={
        <Row gap={8}>
          <Badge outline marker={false}>
            Sample data
          </Badge>
          {actions}
        </Row>
      }
    />
  );
}

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="ds-record__facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StandingBadge({ standing }: { standing: unknown }) {
  const restricted =
    word(standing).toLowerCase().includes("paused") ||
    word(standing).toLowerCase().includes("restrict");
  return (
    <Badge tone={restricted ? "warning" : "success"}>
      {restricted ? "Some features paused" : "Good standing"}
    </Badge>
  );
}

export function OffenseHistory({ offenses }: { offenses: Item[] }) {
  if (!offenses.length)
    return (
      <EmptyState
        title="No offense records"
        description="No offense details are recorded for this student in the available sample data."
      />
    );
  return (
    <Stack gap={12}>
      {offenses.map((offense) => (
        <Card key={word(offense.id)}>
          <CardTitle>
            Level {word(offense.level, "—")} ·{" "}
            {word(offense.status, "Recorded")}
          </CardTitle>
          <CardBody>{word(offense.summary)}</CardBody>
          <CardMeta>
            Decision {word(offense.decisionReference, "—")} ·{" "}
            {word(offense.actorRole, "Authorized office")} ·{" "}
            {shortDate(offense.at)}
          </CardMeta>
        </Card>
      ))}
    </Stack>
  );
}

export function RestrictionPanel({ restrictions }: { restrictions: Item[] }) {
  const ordered = [...restrictions].sort(
    (left, right) =>
      Number(right.active === true) - Number(left.active === true),
  );
  if (!ordered.length)
    return (
      <EmptyState
        title="No active restrictions"
        description="No restriction records are available for this student."
      />
    );
  return (
    <Stack gap={12}>
      {ordered.map((restriction) => (
        <Card key={word(restriction.id)}>
          <CardTitle>
            {Array.isArray(restriction.features)
              ? restriction.features.map(String).join(", ")
              : "Feature restriction"}
          </CardTitle>
          <CardBody>
            {word(restriction.basis, "Basis recorded")}
            {restriction.decisionReference
              ? ` · ${word(restriction.decisionReference)}`
              : ""}
          </CardBody>
          <CardMeta>
            {shortDate(restriction.starts)} to {shortDate(restriction.until)} ·{" "}
            {firstRole(
              object(restriction.authorizer).roles,
              word(restriction.actorRole),
            )}{" "}
            · {restriction.active === true ? "Active" : "Ended"}
          </CardMeta>
        </Card>
      ))}
    </Stack>
  );
}

function ClusterCard({ cluster }: { cluster: Item }) {
  return (
    <Card link className="app-card">
      <CardTitle
        href={"/cases/clusters/" + encodeURIComponent(word(cluster.id))}
      >
        {word(cluster.title, "Similar reports for review")}
      </CardTitle>
      <CardBody>{word(cluster.supporting)}</CardBody>
      <CardMeta>
        {word(cluster.program)} ·{" "}
        {word(cluster.reportCount, String(items(cluster.reportIds).length))}{" "}
        reports · {word(cluster.similarity)}% similarity ·{" "}
        {word(cluster.status, "To review")}
      </CardMeta>
    </Card>
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
        description="It may not exist, or it may be outside your program scope."
      />
    );
  return (
    <Stack gap={20}>
      <Breadcrumbs
        items={[
          { label: "Similar reports", href: "/cases/clusters" },
          { label: word(record.id) },
        ]}
      />
      <PageHeading
        title={word(record.title, "Review a similar-report group")}
        description={`${word(record.program)} · ${word(record.similarity)}% similarity`}
      />
      <Alert tone="neutral" title="This is a review suggestion">
        A similarity summary does not establish that reports describe the same
        event. Review each report and its context.
      </Alert>
      <Facts
        rows={[
          ["Supporting summary", word(record.supporting)],
          ["Different details", word(record.dissenting)],
          [
            "Repeated phrases",
            Array.isArray(record.phrases) ? record.phrases.join(", ") : "—",
          ],
          ["Current status", word(record.status)],
        ]}
      />
      <SectionHeader level={2} title="Reports in this group" />
      {reports.length ? (
        reports.map((report) => (
          <Card key={word(report.id)}>
            <CardTitle>
              {word(report.id)} · {word(report.status)}
            </CardTitle>
            <CardBody>
              {word(
                report.summary,
                "Report details are available in the authorized case view.",
              )}
            </CardBody>
            <CardMeta>
              <Link href={"/cases/" + encodeURIComponent(word(report.id))}>
                Open case
              </Link>
            </CardMeta>
          </Card>
        ))
      ) : (
        <EmptyState title="No reports available" />
      )}
      {word(record.status) === "To review" && (
        <Stack gap={12}>
          <TextArea
            label="Review note"
            value={reason}
            onChange={setReason}
            maxLength={1000}
            description="Record why you confirmed or dismissed this suggestion."
          />
          {action.error && (
            <Alert tone="danger" title="The review couldn't be saved">
              {action.error.message}
            </Alert>
          )}
          <Row gap={8}>
            <Button
              loading={action.isPending}
              isDisabled={!reason.trim()}
              onPress={() =>
                action.mutate({
                  action: "reviewCluster",
                  recordId: word(record.id),
                  payload: { decision: "confirmed" },
                  reason,
                })
              }
            >
              Confirm group
            </Button>
            <Button
              variant="secondary"
              loading={action.isPending}
              isDisabled={!reason.trim()}
              onPress={() =>
                action.mutate({
                  action: "reviewCluster",
                  recordId: word(record.id),
                  payload: { decision: "dismissed" },
                  reason,
                })
              }
            >
              Dismiss suggestion
            </Button>
          </Row>
        </Stack>
      )}
    </Stack>
  );
}

function ClusterList({ page }: { page: PageEnvelope }) {
  const clusters = items(page.data.clusters);
  return (
    <Stack gap={20}>
      <PageHeading
        title="Similar reports"
        description="Review system-generated suggestions within your program."
      />
      <Alert tone="neutral" title="Suggestions need human review">
        No report is grouped into a case automatically. Agreement thresholds are
        not yet approved. <span className="tbd-comment">TBD(D-07)</span>
      </Alert>
      {clusters.length ? (
        <Grid columns={2}>
          {clusters.map((cluster) => (
            <ClusterCard key={word(cluster.id)} cluster={cluster} />
          ))}
        </Grid>
      ) : (
        <EmptyState
          title="No groups to review"
          description="Similar-report suggestions will appear here when available."
        />
      )}
    </Stack>
  );
}

function Analytics({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const session = useQuery(sessionQuery());
  const search = new URLSearchParams(location.searchStr);
  const stats = items(page.data.stats);
  const stageRows = items(page.data.byStage);
  const categories = items(page.data.byCategory);
  const trend = items(page.data.trend);
  const updateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(location.searchStr);
    if (value) next.set(name, value);
    else next.delete(name);
    router.history.replace(
      location.pathname + (next.size ? "?" + next.toString() : ""),
    );
  };
  return (
    <Stack gap={24}>
      <PageHeading
        title="Case analytics"
        description="Counts and trends for your permitted case scope."
      />
      <FilterBar
        query={search.get("q") ?? ""}
        onQueryChange={(value) => updateFilter("q", value)}
        searchLabel="Search by case reference"
        searchPlaceholder="Case reference"
      >
        <Select
          label="Stage"
          selectedKey={search.get("stage") ?? "All"}
          onSelectionChange={(key) =>
            updateFilter("stage", String(key) === "All" ? "" : String(key))
          }
        >
          <SelectOption id="All">All stages</SelectOption>
          {["adviser", "chair", "dean", "guidance", "osas", "executive"].map(
            (stage) => (
              <SelectOption key={stage} id={stage}>
                {stage}
              </SelectOption>
            ),
          )}
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
        {session.data?.user.roles.includes("dean") && (
          <Select
            label="Program"
            selectedKey={search.get("program") ?? "All"}
            onSelectionChange={(key) =>
              updateFilter("program", String(key) === "All" ? "" : String(key))
            }
          >
            <SelectOption id="All">All programs</SelectOption>
            <SelectOption id="BSIT">BSIT</SelectOption>
            <SelectOption id="BSCS">BSCS</SelectOption>
          </Select>
        )}
      </FilterBar>
      <Grid columns={3}>
        {stats.map((stat) => (
          <Stat
            key={word(stat.label)}
            label={word(stat.label)}
            value={word(stat.value)}
            scopeNote={word(stat.note)}
          />
        ))}
      </Grid>
      <Grid columns={2}>
        <BarChart
          title="Cases by stage"
          data={stageRows.map((row) => ({
            label: word(row.label),
            value: Number(row.value ?? 0),
          }))}
        />
        <BarChart
          title="Category counts"
          data={categories.map((row) => ({
            label: word(row.label),
            value: typeof row.value === "number" ? row.value : null,
            suppressed: row.suppressed === true,
          }))}
        />
      </Grid>
      <TrendChart
        title="Opened and resolved reports"
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
      <p className="ds-help-text">
        Counts below the approved threshold are suppressed.
      </p>
      <Alert tone="neutral" title="Privacy note">
        Analytics contain aggregate counts only. Small categories are
        suppressed, and this page does not show report narratives.
      </Alert>
    </Stack>
  );
}

function RecordList({ page }: { page: PageEnvelope }) {
  const students = items(page.data.students);
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("All");
  const [standing, setStanding] = useState("All");
  const [restriction, setRestriction] = useState("All");
  const filtered = students.filter((student) =>
    `${word(student.name)} ${word(student.studentId)} ${word(student.program)} ${word(student.section)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
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
  const matching = filtered.filter(
    (student) =>
      (program === "All" || word(student.program) === program) &&
      (standing === "All" ||
        (standing === "Restricted"
          ? word(student.standing).includes("paused")
          : !word(student.standing).includes("paused"))) &&
      (restriction === "All" ||
        (restriction === "Active"
          ? Array.isArray(student.restrictions) &&
            student.restrictions.length > 0
          : !Array.isArray(student.restrictions) ||
            student.restrictions.length === 0)),
  );
  return (
    <Stack gap={20}>
      <PageHeading title="Student records" description={scope} />
      <PrivacyNotice title="Record access is logged">
        Every record you open is logged with your name and the time. This list
        does not create an access entry.
      </PrivacyNotice>
      <FilterBar
        query={search}
        onQueryChange={setSearch}
        searchLabel="Search by name or student ID"
        searchPlaceholder="Name or student ID"
      >
        {role === "dean" && (
          <Select
            label="Program"
            selectedKey={program}
            onSelectionChange={(key) => setProgram(String(key))}
          >
            <SelectOption id="All">All programs</SelectOption>
            <SelectOption id="BSIT">BSIT</SelectOption>
            <SelectOption id="BSCS">BSCS</SelectOption>
          </Select>
        )}
        <Select
          label="Standing"
          selectedKey={standing}
          onSelectionChange={(key) => setStanding(String(key))}
        >
          <SelectOption id="All">All standing</SelectOption>
          <SelectOption id="Good">Good standing</SelectOption>
          <SelectOption id="Restricted">Some features paused</SelectOption>
        </Select>
        <Select
          label="Active restriction"
          selectedKey={restriction}
          onSelectionChange={(key) => setRestriction(String(key))}
        >
          <SelectOption id="All">Any</SelectOption>
          <SelectOption id="Active">Active</SelectOption>
          <SelectOption id="None">None</SelectOption>
        </Select>
      </FilterBar>
      {matching.length ? (
        <div className="app-card-list">
          {matching.map((student) => (
            <Card key={word(student.id)} link>
              <CardTitle
                href={"/records/" + encodeURIComponent(word(student.id))}
              >
                {word(student.name)}
              </CardTitle>
              <CardBody>
                <span className="ds-table__ref">{word(student.studentId)}</span>{" "}
                · {word(student.program)} · Section {word(student.section)}
              </CardBody>
              <CardMeta>
                <StandingBadge standing={student.standing} />
                {Array.isArray(student.restrictions) &&
                  student.restrictions.length > 0 && (
                    <Badge tone="warning">Restriction active</Badge>
                  )}
              </CardMeta>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            search ||
            program !== "All" ||
            standing !== "All" ||
            restriction !== "All"
              ? "No students match"
              : "No students in your scope yet"
          }
          description="Try a different search or filter."
        />
      )}
    </Stack>
  );
}

function PurposeOfAccessDialog({
  openRecord,
  onCancel,
}: {
  openRecord: (purpose: string, note: string) => void;
  onCancel: () => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal
      title="Open this student record?"
      isOpen
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <ModalBody>
        <p>Opening a record is logged with your name and the time.</p>
        <Select
          label="Purpose"
          selectedKey={purpose || null}
          onSelectionChange={(key) => setPurpose(String(key))}
        >
          <SelectOption id="Case handling">Case handling</SelectOption>
          <SelectOption id="Good Moral review">Good Moral review</SelectOption>
          <SelectOption id="Restriction review">
            Restriction review
          </SelectOption>
          <SelectOption id="Program oversight">Program oversight</SelectOption>
        </Select>
        <TextArea
          label="Note"
          value={note}
          onChange={setNote}
          maxLength={500}
        />
      </ModalBody>
      <ModalActions>
        <Button variant="secondary" onPress={onCancel}>
          Cancel
        </Button>
        <Button isDisabled={!purpose} onPress={() => openRecord(purpose, note)}>
          Open record
        </Button>
      </ModalActions>
    </Modal>
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
    <Stack gap={12}>
      <Alert tone="neutral" title="Certificate rules need QCU approval">
        This page records a prerequisite review. It does not issue a certificate
        or apply a penalty. <span className="tbd-comment">TBD(D-02)</span>
      </Alert>
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
      {Boolean(review.status) && (
        <Facts
          rows={[
            ["Last review", word(review.status)],
            ["Decision source", word(review.decisionSource)],
            ["Recorded", shortDate(review.at)],
            ["Reviewer role", word(review.actorRole, "Authorized office")],
          ]}
        />
      )}
      {action.error && (
        <Alert tone="danger" title="The review couldn't be saved">
          {action.error.message}
        </Alert>
      )}
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
    </Stack>
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
  const location = useRouterState({ select: (state) => state.location });
  const queryParams = new URLSearchParams(location.searchStr);
  const opened = queryParams.has("purpose") && Boolean(page.data.record);
  const record = object(page.data.record);
  const offenses = items(record.offenses);
  const restrictions = items(record.restrictions);
  const session = useQuery(sessionQuery());
  const roles = session.data?.user.roles ?? [];
  const allowedTabs = [
    "overview",
    "offenses",
    "restrictions",
    ...(roles.some((role) => role === "guidance" || role === "osas")
      ? ["good-moral"]
      : []),
  ];
  const requestedTab = queryParams.get("tab") ?? "overview";
  const selectedTab = allowedTabs.includes(requestedTab)
    ? requestedTab
    : "overview";
  const openRecord = (purpose: string, note: string) => {
    queryParams.set("purpose", purpose);
    if (note.trim()) queryParams.set("note", note.trim());
    router.history.replace(location.pathname + "?" + queryParams.toString());
  };
  if (!opened)
    return (
      <PurposeOfAccessDialog
        openRecord={openRecord}
        onCancel={() => router.history.push("/records")}
      />
    );
  if (!record.id)
    return (
      <ViewState
        kind="restricted"
        title="This record isn't available to you"
        description="It may not exist, or it may belong to someone else."
      />
    );
  return (
    <Stack gap={20}>
      <Breadcrumbs
        items={[
          { label: "Student records", href: "/records" },
          { label: word(record.studentId) },
        ]}
      />
      <PageHeading
        title={word(record.name)}
        description={`${word(record.studentId)} · ${word(record.program)} · Section ${word(record.section)}`}
        actions={
          <>
            <StandingBadge standing={record.standing} />
            {restrictions.some(
              (restriction) => restriction.active === true,
            ) && <Badge tone="warning">Restriction active</Badge>}
          </>
        }
      />
      <PrivacyNotice title="Record opening logged">
        Opening this record was logged at{" "}
        {new Date(word(record.openedAt)).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        })}
        .
      </PrivacyNotice>
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          const next = new URLSearchParams(location.searchStr);
          if (key === "overview") next.delete("tab");
          else next.set("tab", String(key));
          router.history.replace(
            location.pathname + (next.size ? "?" + next.toString() : ""),
          );
        }}
      >
        <TabList aria-label="Student record sections">
          <Tab id="overview">Overview</Tab>
          <Tab id="offenses">Offenses</Tab>
          <Tab id="restrictions">Restrictions</Tab>
          {allowedTabs.includes("good-moral") && (
            <Tab id="good-moral">Good Moral</Tab>
          )}
        </TabList>
        <TabPanel id="overview">
          <Facts
            rows={[
              ["Program", word(record.program)],
              ["Section", word(record.section)],
              ["Year", word(record.year)],
              ["Standing", <StandingBadge standing={record.standing} />],
              [
                "Active restrictions",
                restrictions
                  .filter((restriction) => restriction.active === true)
                  .map((restriction) =>
                    Array.isArray(restriction.features)
                      ? restriction.features.join(", ")
                      : "",
                  )
                  .join("; ") || "None",
              ],
            ]}
          />
          {Array.isArray(record.accessHistory) &&
            record.accessHistory.length > 0 && (
              <AuditLog
                entries={items(record.accessHistory)}
                title="Access history"
              />
            )}
        </TabPanel>
        <TabPanel id="offenses">
          <OffenseHistory offenses={offenses} />
        </TabPanel>
        <TabPanel id="restrictions">
          <RestrictionPanel restrictions={restrictions} />
          <Alert tone="neutral" title="Essential access remains available">
            Announcements, academic information, the assistant, and permitted
            professor messages stay available.
          </Alert>
          {(roles.includes("guidance") || roles.includes("osas")) && (
            <RecordRestrictionActions
              restrictions={restrictions}
              osas={roles.includes("osas")}
            />
          )}
        </TabPanel>
        {allowedTabs.includes("good-moral") && (
          <TabPanel id="good-moral">
            <GoodMoralReview
              studentId={studentId}
              review={object(record.goodMoral)}
            />
          </TabPanel>
        )}
      </Tabs>
    </Stack>
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
    <section className="app-region">
      <SectionHeader level={2} title={title} />
      {entries.length ? (
        <ul>
          {entries.map((entry, index) => (
            <li key={word(entry.id, String(index))}>
              {word(object(entry.actor).name, "Authorized user")} ·{" "}
              {word(entry.action)} · {word(entry.module)} ·{" "}
              {word(entry.reference)} · {shortDate(entry.at)}
              {entry.purpose ? ` · Purpose: ${word(entry.purpose)}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No audit entries" />
      )}
    </section>
  );
}

function RestrictionManagement({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const userRoles = session.data?.user.roles ?? [];
  const admin = userRoles.includes("administrator");
  const action = useAction("P35");
  const students = items(page.data.students);
  const restrictions = items(page.data.restrictions);
  const referrals = items(page.data.referrals);
  const [tab, setTab] = useState("active");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [decisionReference, setDecisionReference] = useState("");
  const [basis, setBasis] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const filteredRestrictions = restrictions.filter((restriction) =>
    tab === "ended"
      ? restriction.active !== true
      : tab === "active"
        ? restriction.active === true
        : false,
  );
  const changeRequests = tab === "requests" ? referrals : [];
  const submitApply = () =>
    action.mutate(
      {
        action: "applyRestriction",
        payload: {
          studentId: selectedStudent,
          features,
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
    <Stack gap={20}>
      <PageHeading
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
            <Button onPress={() => setApplyOpen(true)}>
              Apply restriction
            </Button>
          ) : undefined
        }
      />
      <PrivacyNotice title="Restrictions pause selected features only">
        Announcements, academic information, the assistant, and permitted
        professor messages stay available.
      </PrivacyNotice>
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <TabList aria-label="Restriction views">
          <Tab id="active">Active</Tab>
          <Tab id="requests" count={referrals.length}>
            Change requests
          </Tab>
          <Tab id="ended">Ended</Tab>
        </TabList>
        <TabPanel id="active">
          <RestrictionRows rows={filteredRestrictions} onLift={setConfirmId} />
        </TabPanel>
        <TabPanel id="requests">
          {changeRequests.length ? (
            <Stack gap={12}>
              {changeRequests.map((request) => (
                <Card key={word(request.id)}>
                  <CardTitle>
                    {word(object(request.student).name)} ·{" "}
                    {word(request.change)} requested
                  </CardTitle>
                  <CardBody>{word(request.reason)}</CardBody>
                  <CardMeta>
                    {word(request.status)} · {shortDate(request.at)} · Requested
                    by {word(object(request.actor).name)}
                  </CardMeta>
                  {admin && (
                    <Alert
                      tone="neutral"
                      title="Decision workflow is awaiting policy"
                    >
                      Applying a requested end-date change or declining a
                      request is not defined by the current policy.{" "}
                      <span className="tbd-comment">TBD(D-05)</span>
                    </Alert>
                  )}
                </Card>
              ))}
            </Stack>
          ) : (
            <EmptyState title="No change requests" />
          )}
        </TabPanel>
        <TabPanel id="ended">
          <RestrictionRows rows={filteredRestrictions} onLift={setConfirmId} />
        </TabPanel>
      </Tabs>
      {action.error && (
        <Alert tone="danger" title="The change couldn't be saved">
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
            value={features}
            onChange={setFeatures}
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
          <Alert tone="neutral" title="Only the selected features are paused">
            Start date is today.{" "}
            {basis ? "" : "Basis options remain under review."}{" "}
            <span className="tbd-comment">TBD(D-05)</span>
          </Alert>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setApplyOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={action.isPending}
            isDisabled={
              !selectedStudent ||
              !features.length ||
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
    </Stack>
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
  if (!rows.length) return <EmptyState title="No restrictions in this view" />;
  return (
    <Stack gap={12}>
      {rows.map((restriction) => (
        <Card key={word(restriction.id)}>
          <CardTitle>
            {word(object(restriction.student).name)} ·{" "}
            {Array.isArray(restriction.features)
              ? restriction.features.join(", ")
              : "Feature restriction"}
          </CardTitle>
          <CardBody>
            {word(restriction.basis)} · {word(restriction.decisionReference)} ·{" "}
            {shortDate(restriction.starts)} to {shortDate(restriction.until)}
          </CardBody>
          <CardMeta>
            {firstRole(object(restriction.authorizer).roles)} ·{" "}
            {restriction.active ? "Active" : "Ended"}
          </CardMeta>
          {Boolean(restriction.active) && roles.includes("administrator") && (
            <Button
              variant="secondary"
              onPress={() => onLift(word(restriction.id))}
            >
              Lift restriction
            </Button>
          )}
          {Boolean(restriction.active) && canRefer && (
            <Button
              variant="secondary"
              onPress={() => setRequestId(word(restriction.id))}
            >
              Request change
            </Button>
          )}
          {requestId === word(restriction.id) && (
            <RestrictionRequestForm
              restriction={restriction}
              onClose={() => setRequestId("")}
            />
          )}
        </Card>
      ))}
    </Stack>
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
    <Stack gap={8}>
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
      <Row gap={8}>
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
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
      </Row>
    </Stack>
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
    <section className="app-region">
      <SectionHeader level={2} title="Restriction requests" />
      {active.map((restriction) => (
        <Card key={word(restriction.id)}>
          <CardTitle>
            {Array.isArray(restriction.features)
              ? restriction.features.map(String).join(", ")
              : "Selected features"}
          </CardTitle>
          <CardMeta>
            Until {shortDate(restriction.until)} ·{" "}
            {word(restriction.decisionReference)}
          </CardMeta>
          <Button
            variant="secondary"
            onPress={() => setRequestId(word(restriction.id))}
          >
            {osas ? "Record decision or referral" : "Request change"}
          </Button>
          {requestId === word(restriction.id) && (
            <RestrictionRequestForm
              restriction={restriction}
              onClose={() => setRequestId("")}
              pageId="P34"
              osas={osas}
            />
          )}
        </Card>
      ))}
      {osas && (
        <Alert tone="neutral" title="OSAS authority is still being defined">
          This request records a referral and does not apply or lift a
          restriction. <span className="tbd-comment">TBD(OSAS-03)</span>
        </Alert>
      )}
    </section>
  );
}

function StandingPage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const restrictions = items(record.restrictions);
  return (
    <Stack gap={20}>
      <PageHeading title="My account standing" />
      <Row gap={8}>
        <StandingBadge standing={record.standing} />
        <span>
          {record.standing === "Good standing"
            ? "All features are available."
            : "Some features are paused for a limited time."}
        </span>
      </Row>
      {restrictions.length > 0 && (
        <>
          <Alert tone="warning" title="Some features are paused">
            {restrictions.map((restriction) => (
              <p key={word(restriction.id)}>
                {Array.isArray(restriction.features)
                  ? restriction.features.join(", ")
                  : "Selected feature"}{" "}
                · until {shortDate(restriction.until)}
              </p>
            ))}
          </Alert>
          <section>
            <SectionHeader level={2} title="Still available to you" />
            <ul>
              <li>
                <Link href="/feed">Announcements</Link>
              </li>
              <li>
                <Link href="/spaces">Classes and academic information</Link>
              </li>
              <li>
                <Link href="/assistant">Assistant</Link>
              </li>
              <li>
                <Link href="/messages">Messages with your professors</Link>
              </li>
            </ul>
          </section>
        </>
      )}
      <PrivacyNotice title="Classmates see a neutral standing badge">
        Offense details are not shown on your profile.
      </PrivacyNotice>
      <Link href="/directory?q=Guidance">Contact the Guidance Office</Link>
    </Stack>
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
  if (page.isPending)
    return (
      <ViewState
        kind="loading"
        title={pageId === "P34" ? "Loading record" : "Loading information"}
      />
    );
  if (page.isError)
    return page.error instanceof ApiError &&
      [403, 404].includes(page.error.status) ? (
      <ViewState
        kind="restricted"
        title="This record isn't available to you"
        description="It may not exist, or it may belong to someone else."
      />
    ) : (
      <ViewState
        kind="error"
        title="This information couldn't be loaded"
        description="Try again."
        actions={
          <Button variant="secondary" onPress={() => void page.refetch()}>
            Try again
          </Button>
        }
      />
    );
  if (pageId === "P23") return <ClusterList page={page.data} />;
  if (pageId === "P24") return <ClusterReview page={page.data} />;
  if (pageId === "P25") return <Analytics page={page.data} />;
  if (pageId === "P33") return <RecordList page={page.data} />;
  if (pageId === "P34")
    return <StudentRecord page={page.data} studentId={recordId ?? ""} />;
  if (pageId === "P35") return <RestrictionManagement page={page.data} />;
  return <StandingPage page={page.data} />;
}
