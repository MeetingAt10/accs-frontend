import {
  Alert,
  Badge,
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
  Radio,
  RadioGroup,
  SectionHeader,
  Select,
  SelectOption,
  Stack,
  TextArea,
  TextField,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { AuditLog } from "@/components/app/records";
import { Stat, TrendChart } from "@/components/ds-next";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
  type Role,
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
];

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

function Heading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <SectionHeader
      level={1}
      split
      title={title}
      description={description}
      actions={
        <Badge outline marker={false}>
          Sample data
        </Badge>
      }
    />
  );
}

export function PermissionMatrix({ page }: { page: PageEnvelope }) {
  const action = useAction("P48");
  const matrix = items(page.data.permissionMatrix);
  const proposals = object(page.data.permissionProposals);
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
    <Stack gap={20}>
      <Heading
        title="Permission matrix"
        description="Review role access and submit a proposal for a permission change."
      />
      <PrivacyNotice title="Role changes take effect at next sign-in">
        Proposed access is saved for CCS review. This matrix does not decide
        case outcomes or restrictions.
      </PrivacyNotice>
      {matrix.map((entry) => {
        const permission = word(entry.key);
        return (
          <Card key={permission}>
            <CardTitle>{permission}</CardTitle>
            <CardBody>
              <div className="app-permission-grid">
                {roles.map((role) => {
                  const allowed =
                    items(entry.roles).some((item) => word(item) === role) ||
                    (Array.isArray(entry.roles) && entry.roles.includes(role));
                  const proposalKey = `${role}:${permission}`;
                  const proposed = proposals[proposalKey];
                  return (
                    <div className="app-permission-cell" key={proposalKey}>
                      <span>{role}</span>
                      <Badge
                        tone={
                          proposed === undefined
                            ? allowed
                              ? "success"
                              : "neutral"
                            : "warning"
                        }
                      >
                        {proposed === undefined
                          ? allowed
                            ? "Allowed"
                            : "No access"
                          : proposed
                            ? "Proposed: allow"
                            : "Proposed: remove"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() =>
                          setPendingCell({
                            role,
                            permission,
                            allowed: !allowed,
                          })
                        }
                      >
                        Propose change
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        );
      })}
      {action.error && (
        <Alert tone="danger" title="The proposal couldn't be saved">
          {action.error.message}
        </Alert>
      )}
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
    </Stack>
  );
}

export function SystemStatus({ status }: { status: Item }) {
  return (
    <Card>
      <CardTitle>System status</CardTitle>
      <CardBody>
        <dl className="ds-record__facts">
          <div>
            <dt>API</dt>
            <dd>
              <Badge tone="success">{word(status.api, "Unknown")}</Badge>
            </dd>
          </div>
          <div>
            <dt>Assistant</dt>
            <dd>{word(status.assistant, "Unknown")}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{word(status.storage, "Unknown")}</dd>
          </div>
        </dl>
      </CardBody>
      <CardMeta>Prototype status for this process.</CardMeta>
    </Card>
  );
}

function AdminOverview({ page }: { page: PageEnvelope }) {
  const stats = items(page.data.stats);
  const adoption = items(page.data.adoption);
  const status = object(page.data.systemStatus);
  const moderation = items(page.data.moderation);
  const audit = items(page.data.audit);
  return (
    <Stack gap={24}>
      <Heading
        title="Administration"
        description="Account, moderation, audit, and service overview."
      />
      <Grid columns={4}>
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
        <SystemStatus status={status} />
        <section className="app-region">
          <SectionHeader level={2} title="Accounts by role" />
          <ul>
            {adoption.map((entry) => (
              <li key={word(entry.label)}>
                {word(entry.label)}: {word(entry.value)}
              </li>
            ))}
          </ul>
        </section>
      </Grid>
      <Grid columns={2}>
        <section className="app-region">
          <SectionHeader
            level={2}
            split
            title="Recent moderation"
            actions={<Link href="/admin/moderation">Open queue</Link>}
          />
          {moderation.length ? (
            moderation.map((entry) => (
              <Card key={word(entry.id)} link>
                <CardTitle
                  href={
                    "/admin/moderation/" + encodeURIComponent(word(entry.id))
                  }
                >
                  {word(entry.itemType)} · {word(entry.status)}
                </CardTitle>
                <CardMeta>
                  {word(entry.source)} · {word(entry.at)}
                </CardMeta>
              </Card>
            ))
          ) : (
            <EmptyState title="Nothing to review" />
          )}
        </section>
        <AuditLog entries={audit} title="Recent admin actions" />
      </Grid>
      <nav aria-label="Administration pages" className="app-admin-links">
        <Link href="/admin/users">Users and roles</Link>
        <Link href="/admin/roles">Permissions</Link>
        <Link href="/restrictions">Restrictions</Link>
        <Link href="/admin/audit">Audit trail</Link>
        <Link href="/admin/monitoring">Monitoring</Link>
      </nav>
    </Stack>
  );
}

function UsersPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const users = items(page.data.users);
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const results = users.filter((user) =>
    `${word(user.name)} ${word(user.id)} ${word(user.email)} ${word(user.program)} ${word(user.office)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Stack gap={20}>
      <Heading
        title="Users and roles"
        description="Demo accounts from the simulated QCU identity source."
      />
      <Button variant="secondary" onPress={() => setAssignOpen(true)}>
        Assign role
      </Button>
      <PrivacyNotice title="Role changes are recorded">
        Role changes take effect at the next sign-in. Account creation and
        identity matching remain simulated.
      </PrivacyNotice>
      <TextField
        label="Search users"
        placeholder="Name, QCU ID, or email"
        value={search}
        onChange={setSearch}
      />
      {results.length ? (
        <div className="app-card-list">
          {results.map((user) => (
            <Card key={word(user.id)} link>
              <CardTitle
                href={"/admin/users/" + encodeURIComponent(word(user.id))}
              >
                {word(user.name)}
              </CardTitle>
              <CardBody>
                <span className="ds-table__ref">{word(user.id)}</span> ·{" "}
                {word(user.email)}
              </CardBody>
              <CardMeta>
                {Array.isArray(user.roles) ? user.roles.join(", ") : ""} ·{" "}
                {word(user.program, word(user.office))} ·{" "}
                {user.active === false ? "Inactive" : "Active"} · Last sign-in
                unavailable
              </CardMeta>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No users match" />
      )}
      <Alert tone="neutral" title="Account source">
        Accounts come from the simulated QCU source. Adding users and preventing
        duplicates are not configured.
      </Alert>
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
            Continue
          </Button>
        </ModalActions>
      </Modal>
    </Stack>
  );
}

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
  return (
    <Stack gap={20}>
      <Heading
        title={word(record.name)}
        description={`${word(record.id)} · ${word(record.email)}`}
      />
      <PrivacyNotice title="Role assignment changes apply at next sign-in">
        The current session keeps its loaded role set. This action is recorded.
      </PrivacyNotice>
      <section>
        <SectionHeader level={2} title="Role assignments" />
        <CheckboxGroup
          label="Assigned roles"
          value={selectedRoles}
          onChange={(next) => setSelectedRoles(next as Role[])}
        >
          {roles.map((role) => (
            <Checkbox key={role} value={role}>
              {role}
            </Checkbox>
          ))}
        </CheckboxGroup>
        <Grid columns={2}>
          <TextField label="Program" value={program} onChange={setProgram} />
          <TextField label="Section" value={section} onChange={setSection} />
        </Grid>
        <TextArea
          label="Reason"
          isRequired
          value={reason}
          onChange={setReason}
          maxLength={1000}
        />
        {action.error && (
          <Alert tone="danger" title="Role assignment couldn't be saved">
            {action.error.message}
          </Alert>
        )}
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
      </section>
      <section>
        <SectionHeader level={2} title="Account" />
        <Badge tone={record.active === false ? "warning" : "success"}>
          {record.active === false ? "Inactive" : "Active"}
        </Badge>
        <p>Account status follows the simulated QCU source.</p>
      </section>
      <AuditLog entries={audit} title="Assignment history" />
    </Stack>
  );
}

function ModerationQueue({ page }: { page: PageEnvelope }) {
  const moderation = items(page.data.moderation);
  const [status, setStatus] = useState("Pending");
  const [type, setType] = useState("All");
  const visible = moderation.filter(
    (item) =>
      (!status || word(item.status) === status) &&
      (type === "All" || word(item.itemType) === type),
  );
  return (
    <Stack gap={20}>
      <Heading
        title="Moderation"
        description="Items reported for human review."
      />
      <PrivacyNotice title="A flag is not proof">
        Review context before deciding. A moderation flag does not create a
        grievance or apply a restriction.
      </PrivacyNotice>
      <Grid columns={2}>
        <Select
          label="Status"
          selectedKey={status}
          onSelectionChange={(key) => setStatus(String(key))}
        >
          <SelectOption id="Pending">Flagged by filter or users</SelectOption>
          <SelectOption id="Decided">Decided</SelectOption>
        </Select>
        <Select
          label="Item type"
          selectedKey={type}
          onSelectionChange={(key) => setType(String(key))}
        >
          <SelectOption id="All">All types</SelectOption>
          <SelectOption id="post">Post</SelectOption>
          <SelectOption id="comment">Comment</SelectOption>
          <SelectOption id="message">Message</SelectOption>
        </Select>
      </Grid>
      {visible.length ? (
        <div className="app-card-list">
          {visible.map((item) => (
            <Card key={word(item.id)} link>
              <CardTitle
                href={"/admin/moderation/" + encodeURIComponent(word(item.id))}
              >
                {word(item.itemType)} · {word(item.reason)}
              </CardTitle>
              <CardBody>{word(item.excerpt)}</CardBody>
              <CardMeta>
                {word(item.source)} · {word(item.status)} · {word(item.at)}
              </CardMeta>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing to review" />
      )}
    </Stack>
  );
}

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
  return (
    <Stack gap={20}>
      <Heading
        title={`Flagged ${word(record.itemType, "item")}`}
        description={`${word(record.source)} · ${word(record.at)}`}
      />
      <Facts
        rows={[
          ["Reason", word(record.reason)],
          ["Source", word(record.source)],
          [
            "Reporter",
            record.reporter
              ? word(object(record.reporter).name, "Verified community member")
              : "Automated review",
          ],
          ["Status", word(record.status)],
        ]}
      />
      <section className="app-region">
        <SectionHeader level={2} title="Context" />
        {messages.length ? (
          messages.map((message) => (
            <Card key={word(message.id)}>
              <CardBody>{word(message.body)}</CardBody>
              <CardMeta>
                {word(object(message.author).name, "Community member")} ·{" "}
                {word(message.at)}
              </CardMeta>
            </Card>
          ))
        ) : (
          <Card>
            <CardTitle>
              {word(post.title, word(record.itemType, "Flagged content"))}
            </CardTitle>
            <CardBody>
              {word(
                record.excerpt,
                word(post.body, "Content is not available."),
              )}
            </CardBody>
          </Card>
        )}
      </section>
      <Alert tone="neutral" title="Review the context">
        A flag does not establish a rule violation. Do not apply restrictions
        from this screen.
      </Alert>
      {word(record.status) === "Pending" && (
        <>
          <RadioGroup label="Decision" value={decision} onChange={setDecision}>
            <Radio value="keep" card>
              Keep (no action)
            </Radio>
            <Radio value="remove" card>
              Remove content
            </Radio>
            <Radio value="warn" card>
              Remove and warn the author
            </Radio>
            <Radio value="refer" card isDisabled={!userReport}>
              Refer as a possible grievance{" "}
              {userReport ? "" : "(user reports only)"}
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
            Notify the author, where permitted
          </Checkbox>
          {action.error && (
            <Alert tone="danger" title="The decision couldn't be recorded">
              {action.error.message}
            </Alert>
          )}
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
        </>
      )}
      {history.length > 0 && (
        <AuditLog entries={history} title="Review history" />
      )}
      <Link href="/restrictions">
        Apply an approved restriction in Restrictions
      </Link>
    </Stack>
  );
}

export function SystemMonitoring({ page }: { page: PageEnvelope }) {
  const stats = items(page.data.stats);
  const trend = items(page.data.trend);
  const incidents = items(page.data.incidents);
  const telemetry = items(page.data.telemetry);
  return (
    <Stack gap={24}>
      <Heading
        title="Monitoring"
        description="Aggregate service status and assistant activity for this process."
      />
      <Tabs defaultSelectedKey="uptime">
        <TabList aria-label="Monitoring views">
          <Tab id="uptime">Uptime</Tab>
          <Tab id="assistant">Assistant</Tab>
        </TabList>
        <TabPanel id="uptime">
          <SystemStatus status={object(page.data.systemStatus)} />
          <section className="app-region">
            <SectionHeader level={2} title="Incidents" />
            {incidents.length ? (
              <ul>
                {incidents.map((incident) => (
                  <li key={word(incident.id)}>
                    {word(incident.service)} · {word(incident.start)} ·{" "}
                    {word(incident.note)}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No incidents recorded"
                description="No incidents are recorded by the in-memory prototype."
              />
            )}
          </section>
        </TabPanel>
        <TabPanel id="assistant">
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
          <section className="app-region">
            <SectionHeader level={2} title="Assistant activity" />
            {trend.length ? (
              <TrendChart
                title="Assistant sessions per day"
                data={trend.map((row) => ({
                  label: word(row.label),
                  value: Number(row.value ?? 0),
                }))}
              />
            ) : (
              <EmptyState
                title="No activity data"
                description="No assistant sessions are recorded in this process yet."
              />
            )}
          </section>
          <Alert tone="neutral" title="Conversation content is not shown">
            Assistant monitoring contains aggregate telemetry only. Conversation
            log access requires separate approval.
          </Alert>
          {telemetry.length > 0 && (
            <Card>
              <CardTitle>Service timings</CardTitle>
              <CardBody>
                {telemetry
                  .map(
                    (entry) =>
                      `${word(entry.category)} · ${word(entry.durationMs)} ms · ${entry.success ? "Success" : "Failure"}`,
                  )
                  .join(" | ")}
              </CardBody>
            </Card>
          )}
        </TabPanel>
      </Tabs>
    </Stack>
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
    return <ViewState kind="loading" title="Loading administration" />;
  if (!roleAllowed)
    return (
      <ViewState
        kind="restricted"
        title="This page isn't available to your role."
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
        title="This information couldn't be loaded"
        description="Try again."
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

function AuditLogPage({ page }: { page: PageEnvelope }) {
  const rows = items(page.data.audit);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
  return (
    <Stack gap={20}>
      <Heading
        title="Audit trail"
        description="Role, permission, restriction, case, moderation, identity, and record-access events."
      />
      <PrivacyNotice title="Confidential content is excluded">
        The log shows references, never report narratives or message text.
      </PrivacyNotice>
      <TextField
        label="Search audit entries"
        placeholder="Actor, action, module, or reference"
        value={query}
        onChange={setQuery}
      />
      <Grid columns={2}>
        <Select
          label="Module"
          selectedKey={module}
          onSelectionChange={(key) => setModule(String(key))}
        >
          <SelectOption id="All">All modules</SelectOption>
          {["identity", "restrictions", "cases", "moderation", "records"].map(
            (value) => (
              <SelectOption key={value} id={value}>
                {value}
              </SelectOption>
            ),
          )}
        </Select>
        <Select
          label="Action"
          selectedKey={actionFilter}
          onSelectionChange={(key) => setActionFilter(String(key))}
        >
          <SelectOption id="All">All actions</SelectOption>
          {[
            "Role assignment changed",
            "Permission change proposed",
            "Restriction applied",
            "Restriction lifted",
            "Case transition",
            "Moderation decision",
            "Identity disclosed",
            "Record opened",
          ].map((value) => (
            <SelectOption key={value} id={value}>
              {value}
            </SelectOption>
          ))}
        </Select>
        <TextField type="date" label="From" value={from} onChange={setFrom} />
        <TextField type="date" label="To" value={to} onChange={setTo} />
      </Grid>
      <AuditLog entries={filtered} title={`${filtered.length} audit entries`} />
    </Stack>
  );
}
