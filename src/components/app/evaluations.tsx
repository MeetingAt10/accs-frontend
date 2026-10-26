import {
  Accordion,
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Cell,
  Checkbox,
  CheckboxGroup,
  Column,
  DatePicker,
  Disclosure,
  EmptyState,
  Grid,
  Link,
  MenuButton,
  MenuItem,
  Meter,
  Modal,
  ModalActions,
  ModalBody,
  PrivacyNotice,
  Progress,
  Radio,
  RadioGroup,
  Row,
  SectionHeader,
  Select,
  SelectOption,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  Tabs,
  TextArea,
  TextField,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import {
  RequirePermission,
  RestrictedView,
  RetryView,
} from "@/components/app/guards";
import {
  BarChart,
  FilterBar,
  ProfileHeader,
  RatingScale,
  Stat,
  type ChartDatum,
} from "@/components/ds-next";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageQuery, sessionQuery } from "@/lib/queries";

type Item = Record<string, unknown>;
type Answers = Record<string, string | number>;
type EvaluationForm = "student" | "peer" | "upward-chair" | "upward-dean";

export interface EvaluationQuestion {
  id: string;
  criterion: string;
  text: string;
  type: "rating" | "text";
  required: boolean;
}

const formLabels: Record<EvaluationForm, string> = {
  student: "Student to faculty",
  peer: "Faculty peer",
  "upward-chair": "Upward: Program Chair",
  "upward-dean": "Upward: Dean",
};

function object(value: unknown): Item {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Item)
    : {};
}

function items(value: unknown): Item[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function words(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function date(value: unknown, time = false): string {
  const raw = words(value);
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return "Not set";
  return time
    ? parsed.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : parsed.toLocaleDateString("en-PH", { dateStyle: "medium" });
}

function questions(value: unknown): EvaluationQuestion[] {
  return items(value).map((question) => ({
    id: words(question.id),
    criterion: words(question.criterion),
    text: words(question.text),
    type: question.type === "text" ? "text" : "rating",
    required: question.required === true,
  }));
}

function useEvaluationAction(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["page"] });
      toast(result.message, { tone: "success" });
    },
  });
}

function useFilters() {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const params = new URLSearchParams(location.searchStr);

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(location.searchStr);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.history.replace(
      location.pathname + (next.size ? "?" + next.toString() : ""),
    );
  }

  return { params, update };
}

function Heading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
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

function ActionError({ error }: { error: unknown }) {
  return error ? (
    <Alert tone="danger" title="The change couldn't be saved">
      {error instanceof Error
        ? error.message
        : "Try again. Your entered text is kept."}
    </Alert>
  ) : null;
}

function EvaluationHome({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const assignments = items(page.data.assignments);
  const reviews = items(page.data.reviewCycles);
  const submitted = assignments.filter(
    (assignment) => assignment.status === "Submitted",
  ).length;
  const first = assignments[0];
  const professor = session.data?.user.roles.includes("professor") === true;

  return (
    <Stack gap={24}>
      <Heading
        title="Evaluations"
        description={
          first
            ? `${words(first.cycleTitle)} · closes ${date(first.due)}`
            : "Assigned forms and published results"
        }
        actions={
          page.data.canConfigure === true ? (
            <>
              <Button href="/evaluations/cycles">Manage cycles</Button>
              <Button href="/evaluations/results" variant="secondary">
                Results
              </Button>
            </>
          ) : undefined
        }
      />
      {assignments.length > 0 && (
        <Progress
          label={`${submitted} of ${assignments.length} submitted`}
          value={submitted}
          maxValue={assignments.length}
          showValue={false}
        />
      )}
      <Tabs defaultSelectedKey="forms">
        <TabList aria-label="Evaluation views">
          <Tab id="forms">To complete</Tab>
          {professor && (
            <Tab id="review" count={reviews.length}>
              Questions to review
            </Tab>
          )}
        </TabList>
        <TabPanel id="forms">
          {assignments.length ? (
            <Table aria-label="Assigned evaluations">
              <TableHeader>
                <Column isRowHeader>Evaluated person</Column>
                <Column>Subject or relation</Column>
                <Column>Due</Column>
                <Column>Status</Column>
                <Column>Action</Column>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const faculty = object(assignment.faculty);
                  return (
                    <TableRow
                      id={words(assignment.id)}
                      key={words(assignment.id)}
                    >
                      <Cell>
                        <Row gap={8}>
                          <Avatar name={words(faculty.name)} size={32} />
                          {words(faculty.name)}
                        </Row>
                      </Cell>
                      <Cell>
                        {words(assignment.subject)}
                        <br />
                        {words(assignment.relation)}
                      </Cell>
                      <Cell>{date(assignment.due)}</Cell>
                      <Cell>
                        <Badge
                          tone={
                            assignment.status === "Submitted"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {words(assignment.status)}
                        </Badge>
                      </Cell>
                      <Cell>
                        <Link
                          href={
                            "/evaluations/forms/" +
                            encodeURIComponent(words(assignment.id))
                          }
                        >
                          {assignment.status === "Submitted"
                            ? "View receipt"
                            : "Start"}
                        </Link>
                      </Cell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No evaluations open"
              description="You'll get a notification when the next cycle opens."
            />
          )}
        </TabPanel>
        {professor && (
          <TabPanel id="review">
            {reviews.length ? (
              <Stack gap={16}>
                {reviews.map((cycle) => (
                  <Row justify="between" key={words(cycle.id)}>
                    <div>
                      <strong>{words(cycle.title)}</strong>
                      <p>{words(cycle.term)} · In faculty review</p>
                    </div>
                    <Link
                      href={
                        "/evaluations/cycles/" +
                        encodeURIComponent(words(cycle.id)) +
                        "/review"
                      }
                    >
                      Review questions
                    </Link>
                  </Row>
                ))}
              </Stack>
            ) : (
              <ViewState kind="empty" title="Nothing to review right now" />
            )}
          </TabPanel>
        )}
      </Tabs>
      {page.data.canViewResults === true && (
        <Link variant="standalone" href="/evaluations/results">
          {professor ? "See my results" : "See evaluation results"}
        </Link>
      )}
      {/* TBD(D-01): participation rules are undecided; no penalty or enforcement state is shown. */}
    </Stack>
  );
}

function EvaluationFormPage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const [receipt, setReceipt] = useState<Item>();
  const current = receipt ?? record;
  const faculty = object(current.faculty);
  const formQuestions = questions(current.questions);
  const [answers, setAnswers] = useState<Answers>(
    () => object(record.answers) as Answers,
  );
  const [comment, setComment] = useState(words(record.comment));
  const [showValidation, setShowValidation] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const action = useEvaluationAction("P27");
  const submitted = Boolean(current.submittedAt);
  const missing = formQuestions.filter(
    (question) =>
      question.required &&
      (answers[question.id] === undefined || answers[question.id] === ""),
  );
  const answered = formQuestions.filter(
    (question) =>
      answers[question.id] !== undefined && answers[question.id] !== "",
  ).length;

  async function submit() {
    if (submitted || action.isPending) return;
    try {
      const result = await action.mutateAsync({
        action: "submitEvaluation",
        recordId: words(record.id),
        payload: { answers, comment },
      });
      setReceipt(object(result.record));
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
    }
  }

  if (!record.id) return <RestrictedView record />;
  if (!submitted && current.cycleStatus !== "Published") {
    return (
      <ViewState
        kind="empty"
        title={
          current.cycleStatus === "Closed"
            ? `This evaluation closed on ${date(current.due)}`
            : "This evaluation isn't open yet"
        }
        description="Submitted receipts stay available to their evaluator."
      />
    );
  }

  return (
    <Stack gap={24}>
      <Breadcrumbs
        items={[
          { label: "Evaluations", href: "/evaluations" },
          { label: `${words(faculty.name)} · ${words(current.subject)}` },
        ]}
      />
      <Heading
        title={"Evaluate " + words(faculty.name)}
        description={`${words(current.subject)} · ${words(current.cycleTitle)}`}
      />
      <PrivacyNotice title="How answers are shown">
        Your answers are combined with others. Summaries never show individual
        answers.
      </PrivacyNotice>
      <div className="ds-prose">
        <p>{words(current.instructions)}</p>
      </div>
      {submitted && (
        <Alert
          tone="success"
          title={"Submitted " + date(current.submittedAt, true)}
        >
          Your evaluation was saved. These answers are read only.
        </Alert>
      )}
      {showValidation && missing.length > 0 && (
        <Alert
          tone="danger"
          title={`${missing.length} ${missing.length === 1 ? "question needs" : "questions need"} an answer`}
        >
          Complete each marked question before submitting.
        </Alert>
      )}
      <ActionError error={action.error} />
      <Progress
        label={`${answered} of ${formQuestions.length} answered`}
        value={answered}
        maxValue={Math.max(1, formQuestions.length)}
        showValue={false}
      />
      {formQuestions.map((question) =>
        question.type === "rating" ? (
          <RatingScale
            key={question.id}
            label={question.text}
            description={question.criterion}
            value={
              typeof answers[question.id] === "number"
                ? (answers[question.id] as number)
                : undefined
            }
            onChange={(value) =>
              setAnswers((currentAnswers) => ({
                ...currentAnswers,
                [question.id]: value,
              }))
            }
            isRequired={question.required}
            isInvalid={
              showValidation &&
              missing.some((entry) => entry.id === question.id)
            }
            errorMessage="Choose a rating."
            isReadOnly={submitted}
          />
        ) : (
          <TextArea
            key={question.id}
            label={question.text}
            description={question.criterion}
            value={words(answers[question.id])}
            onChange={(value) =>
              setAnswers((currentAnswers) => ({
                ...currentAnswers,
                [question.id]: value,
              }))
            }
            maxLength={1000}
            isRequired={question.required}
            isInvalid={
              showValidation &&
              missing.some((entry) => entry.id === question.id)
            }
            errorMessage="Answer this question."
            isReadOnly={submitted}
          />
        ),
      )}
      <TextArea
        label="Anything else?"
        value={comment}
        onChange={setComment}
        maxLength={1000}
        showCount
        isReadOnly={submitted}
        description="Optional"
      />
      {!submitted && (
        <Button
          onPress={() => {
            setShowValidation(true);
            if (!missing.length) setConfirmOpen(true);
          }}
          loading={action.isPending}
        >
          Submit evaluation
        </Button>
      )}
      <Modal
        role="alertdialog"
        title="Submit your evaluation?"
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
        <ModalBody>You can't change answers after you submit.</ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setConfirmOpen(false)}>
            Keep editing
          </Button>
          <Button onPress={() => void submit()} loading={action.isPending}>
            Submit evaluation
          </Button>
        </ModalActions>
      </Modal>
    </Stack>
  );
}

function CycleSelect({ cycles }: { cycles: Item[] }) {
  const { params, update } = useFilters();
  return (
    <Select
      label="Cycle"
      selectedKey={params.get("cycle") ?? "all"}
      onSelectionChange={(key) =>
        update({ cycle: key === "all" ? undefined : String(key) })
      }
    >
      <SelectOption id="all">All published cycles</SelectOption>
      {cycles.map((cycle) => (
        <SelectOption id={words(cycle.id)} key={words(cycle.id)}>
          {words(cycle.title)}
        </SelectOption>
      ))}
    </Select>
  );
}

function FacultyResults({
  page,
  result,
}: {
  page: PageEnvelope;
  result: Item;
}) {
  const session = useQuery(sessionQuery());
  const faculty = object(result.faculty);
  const [note, setNote] = useState("");
  const action = useEvaluationAction("P29");
  const canFollowUp =
    session.data?.user.roles.some((role) =>
      ["chair", "dean"].includes(role),
    ) === true;
  const programAverage = object(page.data.programAverage);
  const programCriteria = items(programAverage.criteria);
  const criteria = items(result.criteria).map((criterion) => ({
    label: words(criterion.label),
    value: number(criterion.value),
    reference: programCriteria.find((entry) => entry.label === criterion.label)
      ?.value,
  }));

  if (!result.id) return <RestrictedView record />;
  return (
    <Stack gap={24}>
      <Breadcrumbs
        items={[
          { label: "Results", href: "/evaluations/results" },
          { label: words(faculty.name) },
        ]}
      />
      <ProfileHeader
        compact
        name={words(faculty.name)}
        role={strings(faculty.roles).join(" · ")}
        title={words(faculty.program)}
      />
      <CycleSelect cycles={items(page.data.cycles)} />
      <PrivacyNotice title="Combined feedback">
        Individual answers aren't shown. Results appear after a cycle is
        published.
      </PrivacyNotice>
      {number(result.responses) > 0 ? (
        <>
          <Grid columns={3}>
            <Stat
              label="Overall average"
              value={number(result.average).toFixed(2)}
              scopeNote="Rating scale 1–5"
            />
            <Stat
              label="Responses"
              value={number(result.responses)}
              scopeNote="Combined answers only"
            />
            <Stat
              label="Completion"
              value={number(result.completion) + "%"}
              scopeNote="Within the visible scope"
            />
          </Grid>
          <BarChart
            title="By criterion"
            data={criteria}
            max={5}
            referenceLabel={`${words(programAverage.program, "Program")} average`}
          />
          <SectionHeader level={2} title="Feedback themes" />
          <Accordion>
            {items(result.themes).map((theme, index) => (
              <Disclosure
                title={`${words(theme.title)} (${number(theme.count)})`}
                key={words(theme.title, String(index))}
              >
                <p>{words(theme.summary)}</p>
              </Disclosure>
            ))}
          </Accordion>
        </>
      ) : (
        <ViewState
          kind="empty"
          title="Results for this cycle aren't published yet"
        />
      )}
      <Alert tone="neutral" title="Results describe feedback">
        They aren't findings about conduct.
      </Alert>
      {/* TBD(D-08): release thresholds and feedback retention need QCU approval. */}
      {canFollowUp && (
        <Stack gap={16}>
          <TextArea
            label="Follow-up note"
            value={note}
            onChange={setNote}
            maxLength={4000}
          />
          <ActionError error={action.error} />
          <Button
            isDisabled={!note.trim()}
            loading={action.isPending}
            onPress={() =>
              action.mutate(
                {
                  action: "saveFollowUp",
                  recordId: words(result.id),
                  payload: { note },
                },
                { onSuccess: () => setNote("") },
              )
            }
          >
            Save
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function ResultsOverview({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const { params, update } = useFilters();
  const [query, setQuery] = useState("");
  const results = items(page.data.results);
  const oversight =
    session.data?.user.roles.some((role) =>
      ["chair", "dean"].includes(role),
    ) === true;
  const dean = session.data?.user.roles.includes("dean") === true;
  const filtered = results.filter((result) =>
    words(object(result.faculty).name)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const responses = results.reduce(
    (total, result) => total + number(result.responses),
    0,
  );
  const criteria: ChartDatum[] = ["Clarity", "Support", "Fairness"].map(
    (label) => {
      const values = results.flatMap((result) =>
        items(result.criteria)
          .filter((criterion) => criterion.label === label)
          .map((criterion) => number(criterion.value)),
      );
      return {
        label,
        value: values.length
          ? Number(
              (
                values.reduce((total, value) => total + value, 0) /
                values.length
              ).toFixed(2),
            )
          : 0,
      };
    },
  );

  if (!oversight)
    return <FacultyResults page={page} result={results[0] ?? {}} />;
  return (
    <Stack gap={24}>
      <Heading title="Evaluation results" description={page.scope} />
      <CycleSelect cycles={items(page.data.cycles)} />
      <PrivacyNotice title="Combined feedback">
        Individual answers aren't shown. Results appear after a cycle is
        published.
      </PrivacyNotice>
      {responses ? (
        <>
          <Grid columns={3}>
            <Stat
              label="Completion rate"
              value={
                Math.round(
                  results.reduce(
                    (total, result) => total + number(result.completion),
                    0,
                  ) / Math.max(1, results.length),
                ) + "%"
              }
            />
            <Stat
              label="Faculty evaluated"
              value={
                results.filter((result) => number(result.responses) > 0).length
              }
              scopeNote={page.scope}
            />
            <Stat
              label="Overall average"
              value={(
                results.reduce(
                  (total, result) => total + number(result.average),
                  0,
                ) / Math.max(1, results.length)
              ).toFixed(2)}
              scopeNote="Rating scale 1–5"
            />
          </Grid>
          <BarChart title="By criterion" data={criteria} max={5} />
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            searchLabel="Find faculty"
          >
            {dean && (
              <Select
                label="Program"
                selectedKey={params.get("program") ?? "all"}
                onSelectionChange={(key) =>
                  update({ program: key === "all" ? undefined : String(key) })
                }
              >
                <SelectOption id="all">All programs</SelectOption>
                {["BSIT", "BSCS", "BSIS"].map((program) => (
                  <SelectOption id={program} key={program}>
                    {program}
                  </SelectOption>
                ))}
              </Select>
            )}
          </FilterBar>
          {filtered.length ? (
            <Table aria-label="Faculty evaluation results">
              <TableHeader>
                <Column isRowHeader>Faculty</Column>
                <Column>Program</Column>
                <Column numeric>Responses</Column>
                <Column numeric>Overall average</Column>
              </TableHeader>
              <TableBody>
                {filtered.map((result) => (
                  <TableRow id={words(result.id)} key={words(result.id)}>
                    <Cell>
                      <Link
                        href={
                          "/evaluations/results/" +
                          encodeURIComponent(words(result.id))
                        }
                      >
                        {words(object(result.faculty).name)}
                      </Link>
                    </Cell>
                    <Cell>{words(object(result.faculty).program, "CCS")}</Cell>
                    <Cell numeric>{number(result.responses)}</Cell>
                    <Cell numeric>{number(result.average).toFixed(2)}</Cell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ViewState kind="empty" title="No faculty match" />
          )}
        </>
      ) : (
        <ViewState
          kind="empty"
          title="Results for this cycle aren't published yet"
        />
      )}
    </Stack>
  );
}

function CyclesPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("1st semester");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const action = useEvaluationAction("P30");
  const cycles = items(page.data.cycles);

  async function create() {
    if (!title.trim() || !opens || !closes || action.isPending) return;
    try {
      const result = await action.mutateAsync({
        action: "createCycle",
        payload: { title, term, opens, closes },
      });
      router.history.push(
        "/evaluations/cycles/" +
          encodeURIComponent(words(object(result.record).id)),
      );
    } catch {
      // The form keeps its values after an error.
    }
  }

  return (
    <Stack gap={24}>
      <Heading
        title="Evaluation cycles"
        actions={
          <Button icon="plus" onPress={() => setOpen(true)}>
            New cycle
          </Button>
        }
      />
      {cycles.length ? (
        <Table aria-label="Evaluation cycles">
          <TableHeader>
            <Column isRowHeader>Cycle</Column>
            <Column>Term and forms</Column>
            <Column>Status</Column>
            <Column>Completion</Column>
            <Column>Dates</Column>
          </TableHeader>
          <TableBody>
            {cycles.map((cycle) => (
              <TableRow id={words(cycle.id)} key={words(cycle.id)}>
                <Cell>
                  <Link
                    href={
                      "/evaluations/cycles/" +
                      encodeURIComponent(words(cycle.id))
                    }
                  >
                    {words(cycle.title)}
                  </Link>
                </Cell>
                <Cell>
                  {words(cycle.term)}
                  <br />
                  {strings(cycle.forms)
                    .map((form) => formLabels[form as EvaluationForm] ?? form)
                    .join(", ") || "No forms configured"}
                </Cell>
                <Cell>
                  <Badge>{words(cycle.status)}</Badge>
                </Cell>
                <Cell>
                  <Meter
                    label="Submitted"
                    minValue={0}
                    maxValue={Math.max(1, number(cycle.assigned))}
                    value={number(cycle.completion)}
                    valueLabel={`${number(cycle.completion)} of ${number(cycle.assigned)}`}
                  />
                </Cell>
                <Cell>
                  {date(cycle.opens)}–{date(cycle.closes)}
                </Cell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="No cycles yet"
          description="Create a draft to configure the first evaluation cycle."
        />
      )}
      <Modal title="New evaluation cycle" isOpen={open} onOpenChange={setOpen}>
        <ModalBody>
          <Stack gap={16}>
            <Select
              label="Term"
              selectedKey={term}
              onSelectionChange={(key) => setTerm(String(key))}
            >
              {["1st semester", "2nd semester", "Summer"].map((entry) => (
                <SelectOption id={entry} key={entry}>
                  {entry}
                </SelectOption>
              ))}
            </Select>
            <TextField
              label="Name"
              value={title}
              onChange={setTitle}
              maxLength={160}
              isRequired
            />
            <DatePicker
              label="Opens"
              onChange={(value) => setOpens(value?.toString() ?? "")}
              isRequired
            />
            <DatePicker
              label="Closes"
              onChange={(value) => setCloses(value?.toString() ?? "")}
              isRequired
            />
            <ActionError error={action.error} />
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={action.isPending}
            isDisabled={!title.trim() || !opens || !closes}
            onPress={() => void create()}
          >
            Create draft
          </Button>
        </ModalActions>
      </Modal>
    </Stack>
  );
}

export function QuestionEditor({
  value,
  onChange,
  isReadOnly = false,
}: {
  value: EvaluationQuestion[];
  onChange: (questions: EvaluationQuestion[]) => void;
  isReadOnly?: boolean;
}) {
  function update(id: string, changes: Partial<EvaluationQuestion>) {
    onChange(
      value.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    );
  }

  function move(index: number, direction: number) {
    const next = [...value];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const moved = next[index];
    next[index] = next[target];
    next[target] = moved;
    onChange(next);
  }

  return (
    <Stack gap={16}>
      {value.length ? (
        <Table aria-label="Evaluation questions">
          <TableHeader>
            <Column isRowHeader>Criterion</Column>
            <Column>Question</Column>
            <Column>Type</Column>
            <Column>Required</Column>
            <Column>Order</Column>
          </TableHeader>
          <TableBody>
            {value.map((question, index) => (
              <TableRow id={question.id} key={question.id}>
                <Cell>
                  <TextField
                    label={`Criterion ${index + 1}`}
                    value={question.criterion}
                    onChange={(criterion) => update(question.id, { criterion })}
                    isReadOnly={isReadOnly}
                    isRequired
                  />
                </Cell>
                <Cell>
                  <TextArea
                    label={`Question ${index + 1}`}
                    value={question.text}
                    onChange={(text) => update(question.id, { text })}
                    isReadOnly={isReadOnly}
                    isRequired
                    maxLength={4000}
                  />
                </Cell>
                <Cell>
                  <Select
                    label={`Question ${index + 1} type`}
                    selectedKey={question.type}
                    onSelectionChange={(key) =>
                      update(question.id, {
                        type: key === "text" ? "text" : "rating",
                      })
                    }
                    isDisabled={isReadOnly}
                  >
                    <SelectOption id="rating">Rating 1–5</SelectOption>
                    <SelectOption id="text">Text</SelectOption>
                  </Select>
                </Cell>
                <Cell>
                  <Switch
                    isSelected={question.required}
                    onChange={(required) => update(question.id, { required })}
                    isDisabled={isReadOnly}
                  >
                    Required
                  </Switch>
                </Cell>
                <Cell>
                  {!isReadOnly && (
                    <MenuButton
                      label={`Actions for question ${index + 1}`}
                      iconOnly
                      onAction={(key) => {
                        if (key === "up") move(index, -1);
                        if (key === "down") move(index, 1);
                        if (key === "delete")
                          onChange(
                            value.filter((entry) => entry.id !== question.id),
                          );
                      }}
                    >
                      <MenuItem id="up" isDisabled={index === 0}>
                        Move up
                      </MenuItem>
                      <MenuItem
                        id="down"
                        isDisabled={index === value.length - 1}
                      >
                        Move down
                      </MenuItem>
                      <MenuItem id="delete" danger>
                        Delete
                      </MenuItem>
                    </MenuButton>
                  )}
                </Cell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ViewState
          kind="empty"
          title="No questions yet"
          description="Add a criterion and question before sending the cycle for review."
        />
      )}
      {!isReadOnly && (
        <Button
          variant="secondary"
          icon="plus"
          onPress={() =>
            onChange([
              ...value,
              {
                id: `Q-${Date.now()}`,
                criterion: "",
                text: "",
                type: "rating",
                required: true,
              },
            ])
          }
        >
          Add question
        </Button>
      )}
      <Disclosure title="Preview">
        <Stack gap={24}>
          {value.map((question) =>
            question.type === "rating" ? (
              <RatingScale
                key={question.id}
                label={question.text || "Question text"}
                description={question.criterion}
                isRequired={question.required}
                isReadOnly
              />
            ) : (
              <TextArea
                key={question.id}
                label={question.text || "Question text"}
                description={question.criterion}
                isReadOnly
              />
            ),
          )}
        </Stack>
      </Disclosure>
    </Stack>
  );
}

function CompletionTable({ title, rows }: { title: string; rows: Item[] }) {
  return (
    <Stack gap={16}>
      <SectionHeader level={2} title={title} />
      {rows.length ? (
        <Table aria-label={title}>
          <TableHeader>
            <Column isRowHeader>Name</Column>
            <Column>Program</Column>
            <Column numeric>Assigned</Column>
            <Column numeric>Submitted</Column>
            <Column>Completion</Column>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow id={words(entry.id)} key={words(entry.id)}>
                <Cell>{words(entry.title, words(entry.name))}</Cell>
                <Cell>{words(entry.program, "CCS")}</Cell>
                <Cell numeric>{number(entry.assigned)}</Cell>
                <Cell numeric>{number(entry.submitted)}</Cell>
                <Cell>
                  <Meter
                    label="Submitted"
                    value={number(entry.submitted)}
                    maxValue={Math.max(1, number(entry.assigned))}
                    valueLabel={`${number(entry.submitted)} of ${number(entry.assigned)}`}
                  />
                </Cell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ViewState kind="empty" title="No assignments in this scope" />
      )}
    </Stack>
  );
}

function CycleEditorPage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const [title, setTitle] = useState(words(record.title));
  const [instructions, setInstructions] = useState(words(record.instructions));
  const [opens, setOpens] = useState(words(record.opens));
  const [closes, setCloses] = useState(words(record.closes));
  const [forms, setForms] = useState(strings(record.forms));
  const [formQuestions, setFormQuestions] = useState(
    questions(record.questions),
  );
  const [confirmStatus, setConfirmStatus] = useState<"Published" | "Closed">();
  const [releaseResults, setReleaseResults] = useState(false);
  const [program, setProgram] = useState("all");
  const [query, setQuery] = useState("");
  const [validation, setValidation] = useState(false);
  const action = useEvaluationAction("P31");
  const editable = ["Draft", "In review"].includes(words(record.status));
  const incomplete = [
    ...(!title.trim() ? ["Name"] : []),
    ...(!instructions.trim() ? ["Instructions"] : []),
    ...(!opens || !closes || closes < opens
      ? ["Valid open and close dates"]
      : []),
    ...(!forms.length ? ["At least one form"] : []),
    ...(!formQuestions.length ||
    formQuestions.some(
      (question) => !question.text.trim() || !question.criterion.trim(),
    )
      ? ["Complete questions and criteria"]
      : []),
  ];
  const completion = items(page.data.completion);
  const facultyCompletion = items(page.data.facultyCompletion);
  const facultyReviews = items(page.data.facultyReviews);
  const visible = (rows: Item[]) =>
    rows.filter(
      (entry) =>
        (program === "all" || entry.program === program) &&
        words(entry.title, words(entry.name))
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const payload = {
    title,
    instructions,
    opens,
    closes,
    forms,
    questions: formQuestions,
  };

  async function save() {
    setValidation(true);
    if (incomplete.length || action.isPending) return;
    try {
      await action.mutateAsync({
        action: "saveCycle",
        recordId: words(record.id),
        payload,
      });
    } catch {
      // Draft values stay available after an error.
    }
  }

  async function advance(status: "In review" | "Published" | "Closed") {
    setValidation(true);
    if (incomplete.length || action.isPending) return;
    try {
      if (editable)
        await action.mutateAsync({
          action: "saveCycle",
          recordId: words(record.id),
          payload,
        });
      await action.mutateAsync({
        action: "cycleAction",
        recordId: words(record.id),
        payload: {
          status,
          publishResults: status === "Closed" && releaseResults,
        },
      });
      setConfirmStatus(undefined);
    } catch {
      setConfirmStatus(undefined);
    }
  }

  if (!record.id) return <RestrictedView record />;
  return (
    <Stack gap={24}>
      <Breadcrumbs
        items={[
          { label: "Cycles", href: "/evaluations/cycles" },
          { label: words(record.title) },
        ]}
      />
      <Heading
        title={words(record.title, "Evaluation cycle")}
        description={words(record.term)}
        actions={
          <>
            <Badge>{words(record.status)}</Badge>
            {record.status === "Draft" && (
              <Button
                isDisabled={incomplete.length > 0}
                loading={action.isPending}
                onPress={() => void advance("In review")}
              >
                Send for review
              </Button>
            )}
            {record.status === "In review" && (
              <Button
                isDisabled={incomplete.length > 0}
                onPress={() => setConfirmStatus("Published")}
              >
                Publish
              </Button>
            )}
            {record.status === "Published" && (
              <Button
                variant="secondary"
                onPress={() => setConfirmStatus("Closed")}
              >
                Close cycle
              </Button>
            )}
          </>
        }
      />
      {incomplete.length > 0 && (
        <Alert
          tone={validation ? "danger" : "neutral"}
          title="Complete the cycle setup"
        >
          <ul>
            {incomplete.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </Alert>
      )}
      <ActionError error={action.error} />
      <Tabs defaultSelectedKey="setup">
        <TabList aria-label="Cycle workspace">
          <Tab id="setup">Setup</Tab>
          <Tab id="questions">Questions</Tab>
          <Tab id="review">Faculty review</Tab>
          <Tab id="completion">Completion</Tab>
        </TabList>
        <TabPanel id="setup">
          <Stack gap={24}>
            <TextField
              label="Name"
              value={title}
              onChange={setTitle}
              maxLength={160}
              isRequired
              isReadOnly={!editable}
            />
            <TextArea
              label="Instructions"
              value={instructions}
              onChange={setInstructions}
              maxLength={4000}
              isRequired
              isReadOnly={!editable}
            />
            <Row gap={16}>
              <DatePicker
                label="Opens"
                description={"Saved date: " + date(opens)}
                onChange={(value) => setOpens(value?.toString() ?? "")}
                isRequired
                isDisabled={!editable}
              />
              <DatePicker
                label="Closes"
                description={"Saved date: " + date(closes)}
                onChange={(value) => setCloses(value?.toString() ?? "")}
                isRequired
                isDisabled={!editable}
              />
            </Row>
            <CheckboxGroup
              label="Forms"
              value={forms}
              onChange={setForms}
              isDisabled={!editable}
              isRequired
            >
              {Object.entries(formLabels).map(([key, label]) => (
                <Checkbox value={key} key={key}>
                  {label}
                </Checkbox>
              ))}
            </CheckboxGroup>
            {/* TBD(D-01): participation rules have no approved value and cannot be changed. */}
            <Select
              label="Participation rule"
              selectedKey="undecided"
              isDisabled
            >
              <SelectOption id="undecided">Not decided</SelectOption>
            </Select>
            <Alert tone="warning" title="Participation rule not decided (D-01)">
              Participation and certificate rules need QCU approval. No grade,
              certificate, or penalty control is available.
            </Alert>
            {/* TBD(D-02): evaluation participation never applies a grade or Good Moral consequence. */}
            {editable && (
              <Button loading={action.isPending} onPress={() => void save()}>
                Save setup
              </Button>
            )}
          </Stack>
        </TabPanel>
        <TabPanel id="questions">
          <Stack gap={24}>
            <QuestionEditor
              value={formQuestions}
              onChange={setFormQuestions}
              isReadOnly={!editable}
            />
            {editable && (
              <Button loading={action.isPending} onPress={() => void save()}>
                Save questions
              </Button>
            )}
          </Stack>
        </TabPanel>
        <TabPanel id="review">
          <Stack gap={24}>
            <SectionHeader level={2} title="Faculty review" />
            {facultyReviews.length ? (
              <Table aria-label="Faculty question reviews">
                <TableHeader>
                  <Column isRowHeader>Professor</Column>
                  <Column>Status</Column>
                  <Column>Comments</Column>
                </TableHeader>
                <TableBody>
                  {facultyReviews.map((review) => (
                    <TableRow id={words(review.id)} key={words(review.id)}>
                      <Cell>{words(review.name)}</Cell>
                      <Cell>
                        <Badge>{words(review.status)}</Badge>
                      </Cell>
                      <Cell>
                        {review.note ? (
                          <Disclosure title="Read comments">
                            <p style={{ whiteSpace: "pre-wrap" }}>
                              {words(review.note)}
                            </p>
                          </Disclosure>
                        ) : (
                          "No comment yet"
                        )}
                      </Cell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <ViewState
                kind="empty"
                title="No faculty reviews yet"
                description="Assigned professors can review the questions while the cycle is in review."
              />
            )}
            {record.status === "Draft" && (
              <Button
                isDisabled={incomplete.length > 0}
                loading={action.isPending}
                onPress={() => void advance("In review")}
              >
                Send for review
              </Button>
            )}
          </Stack>
        </TabPanel>
        <TabPanel id="completion">
          <Stack gap={24}>
            <Grid columns={2}>
              {items(page.data.stats).map((stat) => (
                <Stat
                  key={words(stat.label)}
                  label={words(stat.label)}
                  value={words(stat.value)}
                  scopeNote={words(stat.note)}
                />
              ))}
            </Grid>
            <FilterBar
              query={query}
              onQueryChange={setQuery}
              searchLabel="Find a section or faculty member"
            >
              <Select
                label="Program"
                selectedKey={program}
                onSelectionChange={(key) => setProgram(String(key))}
              >
                <SelectOption id="all">All programs</SelectOption>
                {["BSIT", "BSCS", "BSIS"].map((entry) => (
                  <SelectOption id={entry} key={entry}>
                    {entry}
                  </SelectOption>
                ))}
              </Select>
            </FilterBar>
            <CompletionTable title="By section" rows={visible(completion)} />
            <CompletionTable
              title="By faculty"
              rows={visible(facultyCompletion)}
            />
          </Stack>
        </TabPanel>
      </Tabs>
      <Modal
        role="alertdialog"
        title={
          confirmStatus === "Published"
            ? "Publish this cycle?"
            : "Close this cycle?"
        }
        isOpen={Boolean(confirmStatus)}
        onOpenChange={(open) => {
          if (!open) setConfirmStatus(undefined);
        }}
      >
        <ModalBody>
          <Stack gap={16}>
            <p>
              {confirmStatus === "Published"
                ? "Assigned students and faculty get their forms. Published questions cannot be edited."
                : "People will no longer be able to submit this cycle. Submitted receipts stay available."}
            </p>
            {confirmStatus === "Closed" && (
              <>
                <Checkbox
                  isSelected={releaseResults}
                  onChange={setReleaseResults}
                >
                  Release the aggregate results when this cycle closes
                </Checkbox>
                <Alert tone="neutral" title="Release policy needs approval">
                  The prototype shows combined results only. QCU still needs to
                  approve release thresholds and retention.
                </Alert>
              </>
            )}
            {/* TBD(D-08): aggregate release thresholds and retention are not yet approved. */}
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button
            variant="secondary"
            onPress={() => setConfirmStatus(undefined)}
          >
            Cancel
          </Button>
          <Button
            loading={action.isPending}
            onPress={() => {
              if (confirmStatus) void advance(confirmStatus);
            }}
          >
            {confirmStatus === "Published" ? "Publish cycle" : "Close cycle"}
          </Button>
        </ModalActions>
      </Modal>
    </Stack>
  );
}

function QuestionReviewPage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const formQuestions = questions(record.questions);
  const savedReview = items(record.reviews)[0];
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const action = useEvaluationAction("P32");
  const readOnly = sent || page.data.canReview !== true;

  async function submit() {
    if (readOnly || action.isPending) return;
    const note = formQuestions
      .map(
        (question) =>
          `${question.criterion}: ${decisions[question.id] === "changes" ? "Needs change" : "Yes"}${comments[question.id]?.trim() ? " — " + comments[question.id].trim() : ""}`,
      )
      .join("\n");
    try {
      await action.mutateAsync({
        action: "reviewQuestions",
        recordId: words(record.id),
        payload: {
          decision: Object.values(decisions).includes("changes")
            ? "changes"
            : "reviewed",
          note,
        },
      });
      setSent(true);
    } catch {
      // Comments remain available after an error.
    }
  }

  if (!record.id) return <RestrictedView record />;
  if (record.status !== "In review" && !savedReview)
    return <ViewState kind="empty" title="Nothing to review right now" />;
  return (
    <Stack gap={24}>
      <Breadcrumbs
        items={[
          { label: "Evaluations", href: "/evaluations" },
          { label: "Review questions" },
        ]}
      />
      <Heading
        title="Review the questions about your duties"
        description={words(record.title)}
      />
      <Alert tone="neutral" title="Your comments go to the Dean">
        They are available before the cycle is published.
      </Alert>
      {(sent || savedReview) && (
        <Alert tone="success" title="Review sent">
          Your review is read only.
        </Alert>
      )}
      {savedReview ? (
        <Stack gap={16}>
          {formQuestions.map((question) => (
            <section key={question.id}>
              <SectionHeader level={2} title={question.criterion} />
              <p>{question.text}</p>
            </section>
          ))}
          <Disclosure title="Your recorded review" defaultExpanded>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {words(savedReview.note, "Reviewed without comments.")}
            </p>
          </Disclosure>
        </Stack>
      ) : (
        formQuestions.map((question) => (
          <section
            key={question.id}
            style={{
              display: "grid",
              gap: "var(--ds-space-16)",
              paddingBlock: "var(--ds-space-16)",
              borderBottom: "1px solid var(--ds-border-default)",
            }}
          >
            <SectionHeader level={2} title={question.criterion} />
            <p>{question.text}</p>
            <RadioGroup
              row
              label="Fits my duties?"
              value={decisions[question.id] ?? "reviewed"}
              onChange={(decision) =>
                setDecisions((current) => ({
                  ...current,
                  [question.id]: decision,
                }))
              }
              isReadOnly={readOnly}
            >
              <Radio value="reviewed">Yes</Radio>
              <Radio value="changes">Needs change</Radio>
            </RadioGroup>
            <TextArea
              label="Comment"
              value={comments[question.id] ?? ""}
              onChange={(comment) =>
                setComments((current) => ({
                  ...current,
                  [question.id]: comment,
                }))
              }
              maxLength={Math.max(
                100,
                Math.floor(1800 / Math.max(1, formQuestions.length)),
              )}
              isReadOnly={readOnly}
            />
          </section>
        ))
      )}
      <ActionError error={action.error} />
      {!readOnly && (
        <Button loading={action.isPending} onPress={() => void submit()}>
          Send review
        </Button>
      )}
    </Stack>
  );
}

export function EvaluationPages({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  switch (page.pageId) {
    case "P26":
      return <EvaluationHome page={page} />;
    case "P27":
      return <EvaluationFormPage key={words(record.id)} page={page} />;
    case "P28":
      return <ResultsOverview page={page} />;
    case "P29":
      return (
        <FacultyResults key={words(record.id)} page={page} result={record} />
      );
    case "P30":
      return <CyclesPage page={page} />;
    case "P31":
      return <CycleEditorPage key={words(record.id)} page={page} />;
    case "P32":
      return <QuestionReviewPage key={words(record.id)} page={page} />;
    default:
      return <RestrictedView />;
  }
}

export function EvaluationScreen({ pageId }: { pageId: string }) {
  const params = useParams({ strict: false }) as Record<string, string>;
  const recordId = Object.values(params).at(-1);
  const filters = useRouterState({
    select: (state) => state.location.searchStr.slice(1),
  });
  const session = useQuery(sessionQuery());
  const page = useQuery({
    ...pageQuery(pageId, recordId, filters),
    enabled: session.data?.allowedPages.includes(pageId) === true,
  });

  return (
    <RequirePermission pageId={pageId}>
      <div className="app-page">
        {page.isPending ? (
          <ViewState kind="loading" title="Loading evaluations" />
        ) : page.isError ? (
          page.error instanceof ApiError &&
          [403, 404].includes(page.error.status) ? (
            <RestrictedView
              record={["P27", "P29", "P31", "P32"].includes(pageId)}
            />
          ) : (
            <RetryView onRetry={() => void page.refetch()} />
          )
        ) : (
          <EvaluationPages page={page.data} />
        )}
      </div>
    </RequirePermission>
  );
}
