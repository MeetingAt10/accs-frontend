import { PagedList } from '@/components/app/paging'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Disclosure,
  Icon,
  Link,
  MenuButton,
  MenuItem,
  Modal,
  ModalActions,
  ModalBody,
  Radio,
  RadioGroup,
  Search,
  Select,
  SelectOption,
  Switch,
  TextArea,
  TextField,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  RequirePermission,
  RestrictedView,
  RetryView,
} from "@/components/app/guards";
import {
  Empty,
  Kpi,
  Kpis,
  PageHeader,
  Panel,
  StatusChip,
  siteCrumb,
  toneFor,
  type Tone,
} from "@/components/app/page-shell";
import { RatingScale } from "@/components/ds-next";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { pageQuery, sessionQuery } from "@/lib/queries";

import "./evaluations.css";

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
  "upward-chair": "Faculty to Program Chair",
  "upward-dean": "Faculty to Dean",
};

const ease = [0.16, 1, 0.3, 1] as const;

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

/** Drops server notes that describe the data as sample or prototype material. */
function cleanNote(value: unknown): string | undefined {
  const note = words(value);
  return note && !/synthetic|sample|prototype|demo/i.test(note)
    ? note
    : undefined;
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

function cycleTone(status: string): Tone {
  if (status === "Published") return "ok";
  if (status === "In review") return "info";
  return "neutral";
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

/* ---------- Shared pieces ---------- */

const root = siteCrumb("/evaluations");

function ActionError({ error }: { error: unknown }) {
  return error ? (
    <Alert tone="danger" title="Couldn't save">
      {error instanceof Error
        ? error.message
        : "Try again. Your text is still here."}
    </Alert>
  ) : null;
}

/** Number that counts up to its value (decimals for averages). */
function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce ? value : 0);
  const text = useTransform(
    motionValue,
    (current) => current.toFixed(decimals) + suffix,
  );
  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease });
    return () => controls.stop();
  }, [value, reduce, motionValue]);
  return <motion.span>{text}</motion.span>;
}

function percent(value: number, max: number) {
  return Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
}

function LinearProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  return (
    <div
      className="accs-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: percent(value, max) + "%" }} />
    </div>
  );
}

function Bar({ value, max, index = 0 }: { value: number; max: number; index?: number }) {
  return (
    <div className="ev-bar" aria-hidden="true">
      <i style={{ width: percent(value, max) + "%", "--d": index } as CSSProperties} />
    </div>
  );
}

interface BarDatum {
  label: string;
  value: number;
  reference?: number;
}

function CriteriaBars({
  data,
  max = 5,
  referenceLabel,
}: {
  data: BarDatum[];
  max?: number;
  referenceLabel?: string;
}) {
  return (
    <>
      <ul className="ev-bars" aria-label="Average by criterion">
        {data.map((entry, index) => (
          <li className="ev-bars__row" key={entry.label}>
            <span className="ev-bars__label">{entry.label}</span>
            <div className="ev-bars__track">
              <Bar value={entry.value} max={max} index={index} />
              {entry.reference !== undefined && (
                <span
                  className="ev-bars__ref"
                  style={{ left: percent(entry.reference, max) + "%" }}
                  title={`${referenceLabel ?? "Reference"}: ${entry.reference.toFixed(2)}`}
                />
              )}
            </div>
            <span className="ev-bars__value">
              <AnimatedNumber value={entry.value} decimals={2} />
            </span>
          </li>
        ))}
      </ul>
      {referenceLabel && data.some((entry) => entry.reference !== undefined) && (
        <p className="ev-bars__legend">{referenceLabel}</p>
      )}
    </>
  );
}

interface TabDef {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/** Tab list with a sliding highlight and a cross-fading panel. */
function TabbedViews({ label, tabs }: { label: string; tabs: TabDef[] }) {
  const uid = useId();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  if (!current) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === current.id);
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const target = tabs[next].id;
    setActive(target);
    requestAnimationFrame(() =>
      document.getElementById(`${uid}-tab-${target}`)?.focus(),
    );
  }

  return (
    <div className="accs-stack">
      <LayoutGroup id={uid}>
        <div
          className="ev-tabs"
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab) => {
            const selected = tab.id === current.id;
            return (
              <button
                type="button"
                role="tab"
                className="ev-tab"
                key={tab.id}
                id={`${uid}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
              >
                {selected && (
                  <motion.span
                    layoutId="ev-tab-indicator"
                    className="ev-tab__ind"
                    transition={{ duration: reduce ? 0 : 0.36, ease }}
                  />
                )}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ev-tab__count">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${current.id}`}
          className="ev-tabpanel"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduce ? 0 : 0.24, ease }}
        >
          {current.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Filter chips with a sliding highlight. */
function SlideFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string; count?: number }[];
}) {
  const uid = useId();
  const reduce = useReducedMotion();
  return (
    <LayoutGroup id={uid}>
      <div className="ev-tabs" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              type="button"
              className="ev-tab"
              key={option.id}
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
            >
              {selected && (
                <motion.span
                  layoutId="ev-filter-indicator"
                  className="ev-tab__ind"
                  transition={{ duration: reduce ? 0 : 0.36, ease }}
                />
              )}
              {option.label}
              {option.count !== undefined && (
                <span className="ev-tab__count">{option.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ---------- P26 My evaluations ---------- */

function AssignmentCard({ assignment }: { assignment: Item }) {
  const faculty = object(assignment.faculty);
  const name = words(faculty.name, "Faculty member");
  const done = assignment.status === "Submitted";
  const href = "/evaluations/forms/" + encodeURIComponent(words(assignment.id));
  return (
    <Panel as="article" interactive className="ev-card">
      <div className="ev-card__top">
        <div className="ev-person">
          <span className="accs-avatar" aria-hidden="true">
            {initials(name)}
          </span>
          <div>
            <h3 className="ev-card__name">{name}</h3>
            <p className="ev-card__sub">{words(assignment.subject, "—")}</p>
          </div>
        </div>
        <StatusChip tone={toneFor(words(assignment.status))}>
          {words(assignment.status, "—")}
        </StatusChip>
      </div>
      <div className="ev-card__meta">
        {words(assignment.relation) && (
          <span className="accs-tag">{words(assignment.relation)}</span>
        )}
        <span className="ev-card__due">
          Due <strong>{formatDate(assignment.due)}</strong>
        </span>
      </div>
      <div className="ev-card__foot">
        {done ? (
          <Button href={href} variant="secondary">
            View<span className="ev-sr"> receipt for {name}</span>
          </Button>
        ) : (
          <Button href={href}>
            Start<span className="ev-sr"> evaluation for {name}</span>
          </Button>
        )}
      </div>
    </Panel>
  );
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
  const soonest = assignments
    .filter(
      (assignment) =>
        assignment.status !== "Submitted" &&
        assignment.cycleStatus === "Published",
    )
    .map((assignment) => ({
      assignment,
      time: new Date(words(assignment.due)).getTime(),
    }))
    .filter((entry) => !Number.isNaN(entry.time))
    .sort((a, b) => a.time - b.time)[0]?.assignment;

  const forms = assignments.length ? (
    <div className="accs-grid ev-grid">
      {assignments.map((assignment) => (
        <AssignmentCard
          assignment={assignment}
          key={words(assignment.id)}
        />
      ))}
    </div>
  ) : (
    <Panel>
      <Empty title="No evaluations open">
        A notification arrives when the next cycle opens.
      </Empty>
    </Panel>
  );

  const review = reviews.length ? (
    <Panel flush>
      <ul className="accs-rows">
        {reviews.map((cycle) => (
          <li key={words(cycle.id)}>
            <div className="accs-row ev-row">
              <div>
                <p className="accs-row__title">{words(cycle.title)}</p>
                <p className="accs-row__sub">
                  {words(cycle.term)} · In faculty review
                </p>
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
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  ) : (
    <Panel>
      <Empty title="Nothing to review right now" />
    </Panel>
  );

  return (
    <div className="accs-stack accs-stagger">
      <PageHeader
        title="Evaluations"
        description={
          first
            ? `${words(first.cycleTitle)} · ${submitted} of ${assignments.length} submitted` +
              (soonest ? ` · next due ${formatDate(soonest.due)}` : "")
            : "Your forms and published results"
        }
        actions={
          <>
            {page.data.canConfigure === true && (
              <Button href="/evaluations/cycles">Manage cycles</Button>
            )}
            {page.data.canViewResults === true && (
              <Button href="/evaluations/results" variant="secondary">
                {professor ? "My results" : "Results"}
              </Button>
            )}
          </>
        }
      />
      {professor ? (
        <TabbedViews
          label="Evaluation lists"
          tabs={[
            { id: "forms", label: "To complete", content: forms },
            {
              id: "review",
              label: "Questions to review",
              count: reviews.length,
              content: review,
            },
          ]}
        />
      ) : (
        forms
      )}
      {Array.isArray(page.data.completion) && page.data.completion.length > 0 && (
        <Panel flush title="Your completion">
          <ul className="accs-rows">
            {items(page.data.completion).map((entry) => {
              const status = words(entry.status);
              const label = words(entry.label, status);
              const text = status === "pending" || status === "missing"
                ? `${label}: ${words(entry.submitted, "0")} of ${words(entry.total, "0")}`
                : label;
              const tone = status === "submitted" ? "ok" : status === "missing" ? "danger" : status === "pending" ? "warn" : "neutral";
              return (
                <li key={words(entry.cycleId)}>
                  <div className="accs-row ev-row">
                    <div>
                      <p className="accs-row__title">{words(entry.cycleTitle, "Evaluation cycle")}</p>
                      <p className="accs-row__sub">
                        {words(entry.cycleStatus)}
                        {words(entry.closes) ? ` · closes ${formatDate(entry.closes)}` : ""}
                      </p>
                    </div>
                    <StatusChip tone={tone}>{text}</StatusChip>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="ev-note">Finishing your evaluations is required for clearance once a cycle closes.</p>
        </Panel>
      )}
    </div>
  );
}

/* ---------- P27 Evaluation form ---------- */

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
  const isMissing = (question: EvaluationQuestion) =>
    question.required &&
    (answers[question.id] === undefined || answers[question.id] === "");
  const missing = formQuestions.filter(isMissing);
  const answered = formQuestions.filter(
    (question) =>
      answers[question.id] !== undefined && answers[question.id] !== "",
  ).length;
  const groups = formQuestions.reduce<
    { criterion: string; list: EvaluationQuestion[] }[]
  >((result, question) => {
    const group = result.find((entry) => entry.criterion === question.criterion);
    if (group) group.list.push(question);
    else result.push({ criterion: question.criterion, list: [question] });
    return result;
  }, []);

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
      <div className="ev-form">
        <Panel>
          <Empty
            title={
              current.cycleStatus === "Closed"
                ? `This evaluation closed on ${formatDate(current.due)}`
                : "This evaluation isn't open yet"
            }
          >
            You can still open a form you already submitted.
          </Empty>
        </Panel>
      </div>
    );
  }

  return (
    <div className="ev-form accs-stagger">
      <PageHeader
        crumbs={[
          root,
          { label: `${words(faculty.name)} · ${words(current.subject)}` },
        ]}
        title={"Evaluate " + words(faculty.name)}
        description={`${words(current.subject)} · ${words(current.cycleTitle)}`}
      />
      <div className="accs-stack accs-stack--tight">
        <p className="ev-note">
          Results combine everyone's answers. Nobody sees yours on its
          own.
        </p>
        {words(current.instructions) && (
          <p className="ev-note">{words(current.instructions)}</p>
        )}
      </div>
      <div className="ev-sticky">
        <div className="ev-sticky__row">
          <strong>
            {answered} of {formQuestions.length} answered
          </strong>
          <span>
            {missing.length
              ? `${missing.length} required left`
              : "All required answered"}
          </span>
        </div>
        <LinearProgress
          value={answered}
          max={Math.max(1, formQuestions.length)}
          label="Questions answered"
        />
      </div>
      {submitted && (
        <div className="ev-receipt" role="status">
          <Icon name="check" size={16} />
          Submitted {formatDateTime(current.submittedAt)}. You can't edit
          these answers.
        </div>
      )}
      {showValidation && missing.length > 0 && (
        <Alert
          tone="danger"
          title={`${missing.length} ${missing.length === 1 ? "question needs" : "questions need"} an answer`}
        >
          Answer each required question, then submit.
        </Alert>
      )}
      <ActionError error={action.error} />
      {groups.map((group) => (
        <Panel
          key={group.criterion || "general"}
          className="ev-group"
          title={group.criterion || "General"}
        >
          {group.list.map((question) => (
            <div className="ev-q" key={question.id}>
              {question.type === "rating" ? (
                <RatingScale
                  label={question.text}
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
                  isInvalid={showValidation && isMissing(question)}
                  errorMessage="Choose a rating."
                  isReadOnly={submitted}
                />
              ) : (
                <TextArea
                  label={question.text}
                  value={words(answers[question.id])}
                  onChange={(value) =>
                    setAnswers((currentAnswers) => ({
                      ...currentAnswers,
                      [question.id]: value,
                    }))
                  }
                  maxLength={1000}
                  showCount
                  isRequired={question.required}
                  isInvalid={showValidation && isMissing(question)}
                  errorMessage="Answer this question."
                  isReadOnly={submitted}
                />
              )}
            </div>
          ))}
        </Panel>
      ))}
      <Panel className="ev-group">
        <div className="ev-q">
          <TextArea
            label="Anything else?"
            value={comment}
            onChange={setComment}
            maxLength={1000}
            showCount
            isReadOnly={submitted}
            description="Optional"
          />
        </div>
      </Panel>
      {!submitted && (
        <div className="ev-submitbar">
          <p>
            {missing.length ? (
              <>
                <strong>{missing.length}</strong> required{" "}
                {missing.length === 1 ? "question" : "questions"} left
              </>
            ) : (
              "Ready to submit. You can't change answers afterward."
            )}
          </p>
          <Button
            onPress={() => {
              setShowValidation(true);
              if (!missing.length) setConfirmOpen(true);
            }}
            loading={action.isPending}
          >
            Submit evaluation
          </Button>
        </div>
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
    </div>
  );
}

/* ---------- P28 / P29 Results ---------- */

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
  const criteria: BarDatum[] = items(result.criteria).map((criterion) => {
    const reference = programCriteria.find(
      (entry) => entry.label === criterion.label,
    )?.value;
    return {
      label: words(criterion.label),
      value: number(criterion.value),
      reference: typeof reference === "number" ? reference : undefined,
    };
  });
  const themes = items(result.themes);

  if (!result.id) return <RestrictedView record />;
  return (
    <div className="accs-stack accs-stagger">
      <PageHeader
        crumbs={[
          root,
          { label: "Results", href: "/evaluations/results" },
          { label: words(faculty.name) },
        ]}
        title={words(faculty.name)}
        description={[words(faculty.program), strings(faculty.roles).join(" · ")]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="accs-toolbar">
        <CycleSelect cycles={items(page.data.cycles)} />
      </div>
      {number(result.responses) > 0 ? (
        <>
          <Kpis label="Result summary">
            <Kpi
              label="Overall average"
              value={
                <AnimatedNumber value={number(result.average)} decimals={2} />
              }
              note="Rating scale 1–5"
            />
            <Kpi
              label="Responses"
              value={<AnimatedNumber value={number(result.responses)} />}
              note="Combined, not individual"
            />
            <Kpi
              label="Completion"
              value={
                <AnimatedNumber value={number(result.completion)} suffix="%" />
              }
              note="Of the forms you can see"
            />
          </Kpis>
          <Panel title="By criterion">
            <CriteriaBars
              data={criteria}
              referenceLabel={`${words(programAverage.program, "Program")} average`}
            />
            {programAverage.released === false && (
              <p className="ev-note">
                {words(programAverage.program, "Program")} average available
                when all evaluations are in ({number(programAverage.submitted)}{" "}
                of {number(programAverage.assigned)}).
              </p>
            )}
          </Panel>
          <Panel flush title="Feedback themes">
            {themes.length ? (
              <ul className="accs-rows">
                {themes.map((theme, index) => (
                  <li key={words(theme.title, String(index))}>
                    <div className="ev-theme">
                      <strong>
                        {words(theme.title)}
                        <span className="ev-muted">
                          {number(theme.count)}{" "}
                          {number(theme.count) === 1 ? "mention" : "mentions"}
                        </span>
                      </strong>
                      <p>{words(theme.summary)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No themes yet" />
            )}
          </Panel>
        </>
      ) : (
        <Panel>
          <Empty title="Results for this cycle aren't published yet" />
        </Panel>
      )}
      <p className="ev-note">
        Results show combined feedback after a cycle is published. They
        aren't findings about conduct.
      </p>
      {/* TBD(D-08): release thresholds and feedback retention need QCU approval. */}
      {canFollowUp && (
        <Panel title="Follow-up">
          <div className="ev-followup">
            <TextArea
              label="Follow-up note"
              value={note}
              onChange={setNote}
              maxLength={4000}
            />
            <ActionError error={action.error} />
            <div>
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
                Save note
              </Button>
            </div>
          </div>
        </Panel>
      )}
    </div>
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
  const criteria: BarDatum[] = ["Clarity", "Support", "Fairness"].map(
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
    <div className="accs-stack accs-stagger">
      <PageHeader
        crumbs={[root, { label: "Results" }]}
        title="Evaluation results"
        description={page.scope}
      />
      <p className="ev-note">
        Individual answers aren't shown. Results appear after a cycle is
        published.
      </p>
      {responses > 0 && (
        <Kpis label="Result summary">
          <Kpi
            label="Completion rate"
            value={
              <AnimatedNumber
                value={Math.round(
                  results.reduce(
                    (total, result) => total + number(result.completion),
                    0,
                  ) / Math.max(1, results.length),
                )}
                suffix="%"
              />
            }
          />
          <Kpi
            label="Faculty evaluated"
            value={
              <AnimatedNumber
                value={
                  results.filter((result) => number(result.responses) > 0)
                    .length
                }
              />
            }
            note={page.scope}
          />
          <Kpi
            label="Overall average"
            value={
              <AnimatedNumber
                value={
                  results.reduce(
                    (total, result) => total + number(result.average),
                    0,
                  ) / Math.max(1, results.length)
                }
                decimals={2}
              />
            }
            note="Rating scale 1–5"
          />
        </Kpis>
      )}
      {responses > 0 && (
        <Panel title="By criterion">
          <CriteriaBars data={criteria} />
        </Panel>
      )}
      <div className="accs-toolbar ev-toolbar">
        <div className="accs-grow">
          <Search
            label="Find faculty"
            value={query}
            onChange={setQuery}
            size="sm"
          />
        </div>
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
        <CycleSelect cycles={items(page.data.cycles)} />
      </div>
      {responses > 0 ? (
        filtered.length ? (
          <PagedList items={filtered} noun="faculty">
            {(filtered) => (
            <div className="accs-table-wrap">
              <table className="accs-table" aria-label="Faculty evaluation results">
                <thead>
                  <tr>
                    <th scope="col">Faculty</th>
                    <th scope="col">Program</th>
                    <th scope="col" className="accs-num">
                      Responses
                    </th>
                    <th scope="col">Overall average</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((result, index) => {
                    const faculty = object(result.faculty);
                    const name = words(faculty.name);
                    return (
                      <tr key={words(result.id)}>
                        <td>
                          <div className="ev-person">
                            <Link
                              href={
                                "/evaluations/results/" +
                                encodeURIComponent(words(result.id))
                              }
                            >
                              {name}
                            </Link>
                          </div>
                        </td>
                        <td>{words(faculty.program, "CCS")}</td>
                        <td className="accs-num">{number(result.responses)}</td>
                        <td>
                          <div className="ev-avg">
                            <span className="accs-num">
                              {number(result.average).toFixed(2)}
                            </span>
                            <Bar
                              value={number(result.average)}
                              max={5}
                              index={Math.min(index, 8)}
                            />
                          </div>
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
          <Panel>
            <Empty title="No faculty match">Try a different name.</Empty>
          </Panel>
        )
      ) : (
        <Panel>
          <Empty title="Results for this cycle aren't published yet" />
        </Panel>
      )}
    </div>
  );
}

/* ---------- P30 Cycles ---------- */

function CyclesPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("1st semester");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const action = useEvaluationAction("P30");
  const cycles = items(page.data.cycles);
  const statuses = ["Draft", "In review", "Published", "Closed"].filter(
    (entry) => cycles.some((cycle) => cycle.status === entry),
  );
  const visible = cycles.filter(
    (cycle) =>
      (status === "all" || cycle.status === status) &&
      words(cycle.title).toLowerCase().includes(search.toLowerCase()),
  );

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
    <div className="accs-stack accs-stagger">
      <PageHeader
        crumbs={[root, { label: "Cycles" }]}
        title="Evaluation cycles"
        actions={
          <Button icon="plus" onPress={() => setOpen(true)}>
            New cycle
          </Button>
        }
      />
      {cycles.length > 0 && (
        <div className="accs-toolbar ev-toolbar">
          <div className="accs-grow">
            <Search
              label="Find a cycle"
              value={search}
              onChange={setSearch}
              size="sm"
            />
          </div>
          <SlideFilter
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "all", label: "All", count: cycles.length },
              ...statuses.map((entry) => ({
                id: entry,
                label: entry,
                count: cycles.filter((cycle) => cycle.status === entry).length,
              })),
            ]}
          />
        </div>
      )}
      {cycles.length ? (
        visible.length ? (
          <PagedList items={visible} noun="cycles">
            {(visible) => (
            <div className="accs-table-wrap">
              <table className="accs-table" aria-label="Evaluation cycles">
                <thead>
                  <tr>
                    <th scope="col">Cycle</th>
                    <th scope="col">Term</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Status</th>
                    <th scope="col">Responses</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((cycle) => (
                    <tr key={words(cycle.id)}>
                      <td>
                        <p className="ev-table-title">
                          <Link
                            href={
                              "/evaluations/cycles/" +
                              encodeURIComponent(words(cycle.id))
                            }
                          >
                            {words(cycle.title)}
                          </Link>
                        </p>
                        <p className="ev-table-sub">
                          {strings(cycle.forms)
                            .map(
                              (form) => formLabels[form as EvaluationForm] ?? form,
                            )
                            .join(", ") || "No forms chosen"}
                        </p>
                      </td>
                      <td>{words(cycle.term, "—")}</td>
                      <td className="ev-dates">
                        {formatDate(cycle.opens)} to {formatDate(cycle.closes)}
                      </td>
                      <td>
                        <StatusChip tone={cycleTone(words(cycle.status))}>
                          {words(cycle.status, "—")}
                        </StatusChip>
                      </td>
                      <td>
                        <div className="ev-comp">
                          <Bar
                            value={number(cycle.completion)}
                            max={Math.max(1, number(cycle.assigned))}
                          />
                          <span>
                            {number(cycle.completion)} of {number(cycle.assigned)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </PagedList>
        ) : (
          <Panel>
            <Empty title="No cycles match">Change the search or status.</Empty>
          </Panel>
        )
      ) : (
        <Panel>
          <Empty
            title="No cycles yet"
            action={
              <Button icon="plus" onPress={() => setOpen(true)}>
                New cycle
              </Button>
            }
          >
            Start a draft to set up the first cycle.
          </Empty>
        </Panel>
      )}
      <Modal title="New evaluation cycle" isOpen={open} onOpenChange={setOpen}>
        <ModalBody>
          <div className="ev-fields">
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
          </div>
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
    </div>
  );
}

/* ---------- Question editor (P31) ---------- */

export function QuestionEditor({
  value,
  onChange,
  isReadOnly = false,
}: {
  value: EvaluationQuestion[];
  onChange: (questions: EvaluationQuestion[]) => void;
  isReadOnly?: boolean;
}) {
  const reduce = useReducedMotion();

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
    <div>
      {value.length ? (
        <ol className="ev-qlist" aria-label="Evaluation questions">
          <AnimatePresence initial={false}>
            {value.map((question, index) => (
              <motion.li
                className="ev-qrow"
                key={question.id}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }}
                transition={{ duration: reduce ? 0 : 0.28, ease }}
              >
                <span className="ev-qrow__n" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="ev-qrow__body">
                  <div className="ev-qrow__top">
                    <TextField
                      label={`Criterion ${index + 1}`}
                      value={question.criterion}
                      onChange={(criterion) =>
                        update(question.id, { criterion })
                      }
                      isReadOnly={isReadOnly}
                      isRequired
                    />
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
                    <Switch
                      isSelected={question.required}
                      onChange={(required) => update(question.id, { required })}
                      isDisabled={isReadOnly}
                    >
                      Required
                    </Switch>
                  </div>
                  <TextArea
                    label={`Question ${index + 1}`}
                    value={question.text}
                    onChange={(text) => update(question.id, { text })}
                    isReadOnly={isReadOnly}
                    isRequired
                    maxLength={4000}
                  />
                </div>
                {!isReadOnly && (
                  <div className="ev-qrow__actions">
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
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      ) : (
        <Empty title="No questions yet">
          Add a criterion and question before sending the cycle for review.
        </Empty>
      )}
      {!isReadOnly && (
        <div className="ev-editor-foot">
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
        </div>
      )}
      <div className="ev-preview">
        <Disclosure title="Preview">
          <div className="ev-preview-list">
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
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

/* ---------- P31 Cycle detail ---------- */

function CompletionTable({ title, rows }: { title: string; rows: Item[] }) {
  return (
    <Panel flush title={title}>
      {rows.length ? (
        <PagedList items={rows} noun="students">
          {(rows) => (
          <div className="accs-table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="accs-table" aria-label={title}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Program</th>
                  <th scope="col" className="accs-num">
                    Assigned
                  </th>
                  <th scope="col" className="accs-num">
                    Submitted
                  </th>
                  <th scope="col">Completion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={words(entry.id)}>
                    <td>{words(entry.title, words(entry.name))}</td>
                    <td>{words(entry.program, "CCS")}</td>
                    <td className="accs-num">{number(entry.assigned)}</td>
                    <td className="accs-num">{number(entry.submitted)}</td>
                    <td>
                      <div className="ev-comp">
                        <Bar
                          value={number(entry.submitted)}
                          max={Math.max(1, number(entry.assigned))}
                        />
                        <span>
                          {number(entry.submitted)} of {number(entry.assigned)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </PagedList>
      ) : (
        <Empty title="No assignments in this scope" />
      )}
    </Panel>
  );
}

function CycleEditorPage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const [title, setTitle] = useState(words(record.title));
  const [instructions, setInstructions] = useState(words(record.instructions));
  const [opens, setOpens] = useState(words(record.opens));
  const [closes, setCloses] = useState(words(record.closes));
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
      ? ["Open and close dates (close on or after open)"]
      : []),
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
    // Cycles use the student evaluation form only (MeetingAt10/accs-backend#47).
    forms: ["student"],
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

  const sendForReview = (
    <Button
      isDisabled={incomplete.length > 0}
      loading={action.isPending}
      onPress={() => void advance("In review")}
    >
      Send for review
    </Button>
  );

  const setup = (
    <div className="accs-stack">
      <Panel title="Details">
        <div className="ev-fields">
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
        </div>
      </Panel>
      <Panel title="Schedule and forms">
        <div className="ev-fields ev-fields--2">
          <DatePicker
            label="Opens"
            description={"Saved date: " + formatDate(opens, "Not set")}
            onChange={(value) => setOpens(value?.toString() ?? "")}
            isRequired
            isDisabled={!editable}
          />
          <DatePicker
            label="Closes"
            description={"Saved date: " + formatDate(closes, "Not set")}
            onChange={(value) => setCloses(value?.toString() ?? "")}
            isRequired
            isDisabled={!editable}
          />
        </div>
        <p className="ev-note">
          Form: <strong>{formLabels.student}</strong>. Students evaluate the
          faculty who teach their sections; it is the only form a cycle uses.
        </p>
      </Panel>
      <Panel title="Participation">
        {/* TBD(D-01): participation rules have no approved value and cannot be changed. */}
        <Select label="Participation rule" selectedKey="undecided" isDisabled>
          <SelectOption id="undecided">Not set</SelectOption>
        </Select>
        <p className="ev-note">
          Cycles have no grade, certificate, or penalty settings.
        </p>
        {/* TBD(D-02): evaluation participation never applies a grade or Good Moral consequence. */}
      </Panel>
      {editable && (
        <div>
          <Button loading={action.isPending} onPress={() => void save()}>
            Save setup
          </Button>
        </div>
      )}
    </div>
  );

  const questionsTab = (
    <Panel
      flush
      title="Questions"
      action={
        editable ? (
          <Button loading={action.isPending} onPress={() => void save()}>
            Save questions
          </Button>
        ) : undefined
      }
    >
      <QuestionEditor
        value={formQuestions}
        onChange={setFormQuestions}
        isReadOnly={!editable}
      />
    </Panel>
  );

  const reviewTab = (
    <Panel
      title="Faculty review"
      action={record.status === "Draft" ? sendForReview : undefined}
    >
      {facultyReviews.length ? (
        <ol className="accs-timeline" aria-label="Faculty question reviews">
          {facultyReviews.map((review) => (
            <li key={words(review.id)}>
              <div className="ev-tl">
                <strong>{words(review.name)}</strong>
                <StatusChip
                  tone={
                    review.status === "Reviewed"
                      ? "ok"
                      : review.status === "Commented"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {words(review.status, "—")}
                </StatusChip>
              </div>
              {review.note ? (
                <p className="ev-comment">{words(review.note)}</p>
              ) : (
                <p className="ev-muted">No comment yet</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="No faculty reviews yet">
          Professors can comment on the questions while the cycle is in
          review.
        </Empty>
      )}
    </Panel>
  );

  const completionTab = (
    <div className="accs-stack">
      <Kpis label="Cycle completion">
        {items(page.data.stats).map((stat) => (
          <Kpi
            key={words(stat.label)}
            label={words(stat.label)}
            value={
              typeof stat.value === "number" ? (
                <AnimatedNumber
                  value={stat.value}
                  decimals={Number.isInteger(stat.value) ? 0 : 2}
                />
              ) : (
                words(stat.value, "—")
              )
            }
            note={cleanNote(stat.note)}
          />
        ))}
      </Kpis>
      <div className="accs-toolbar">
        <div className="accs-grow">
          <Search
            label="Find a section or faculty member"
            value={query}
            onChange={setQuery}
            size="sm"
          />
        </div>
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
      </div>
      <CompletionTable title="By section" rows={visible(completion)} />
      <CompletionTable title="By faculty" rows={visible(facultyCompletion)} />
    </div>
  );

  return (
    <div className="accs-stack accs-stagger">
      <PageHeader
        crumbs={[
          root,
          { label: "Cycles", href: "/evaluations/cycles" },
          { label: words(record.title, "Cycle") },
        ]}
        title={words(record.title, "Evaluation cycle")}
        description={words(record.term)}
        actions={
          <>
            <StatusChip tone={cycleTone(words(record.status))}>
              {words(record.status, "—")}
            </StatusChip>
            {record.status === "Draft" && sendForReview}
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
          title="Finish the setup first"
        >
          <ul>
            {incomplete.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </Alert>
      )}
      <ActionError error={action.error} />
      <TabbedViews
        label="Cycle sections"
        tabs={[
          { id: "setup", label: "Setup", content: setup },
          {
            id: "questions",
            label: "Questions",
            count: formQuestions.length,
            content: questionsTab,
          },
          { id: "review", label: "Faculty review", content: reviewTab },
          { id: "completion", label: "Completion", content: completionTab },
        ]}
      />
      <Modal
        role="alertdialog"
        title={
          confirmStatus === "Published"
            ? "Publish this cycle?"
            : "Close this cycle?"
        }
        isOpen={Boolean(confirmStatus)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirmStatus(undefined);
        }}
      >
        <ModalBody>
          <div className="ev-fields">
            <p>
              {confirmStatus === "Published"
                ? "Assigned students and faculty get their forms. You can't edit the questions after this."
                : "Nobody can submit after this. Submitted receipts stay available."}
            </p>
            {confirmStatus === "Closed" && (
              <>
                <Checkbox
                  isSelected={releaseResults}
                  onChange={setReleaseResults}
                >
                  Publish combined results when the cycle closes
                </Checkbox>
                <p className="ev-note">
                  Results are released in combined form only.
                </p>
              </>
            )}
            {/* TBD(D-08): aggregate release thresholds and retention are not yet approved. */}
          </div>
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
    </div>
  );
}

/* ---------- P32 Faculty question review ---------- */

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
          `${question.criterion}: ${decisions[question.id] === "changes" ? "Needs change" : "Yes"}${comments[question.id]?.trim() ? " · " + comments[question.id].trim() : ""}`,
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
    return (
      <div className="ev-form">
        <Panel>
          <Empty title="Nothing to review right now" />
        </Panel>
      </div>
    );

  const recorded = words(savedReview?.note, "Reviewed without comments.")
    .split("\n")
    .filter((line) => line.trim());

  return (
    <div className="ev-form accs-stagger">
      <PageHeader
        crumbs={[root, { label: "Review questions" }]}
        title="Review the questions about your duties"
        description={words(record.title)}
      />
      <p className="ev-note">
        Your comments go to the Dean before the cycle is published.
      </p>
      {(sent || savedReview) && (
        <div className="ev-receipt" role="status">
          <Icon name="check" size={16} />
          Review sent. You can't edit it now.
        </div>
      )}
      {savedReview ? (
        <>
          <Panel flush title="Questions">
            {formQuestions.map((question) => (
              <div className="ev-review-q" key={question.id}>
                <h3>{question.criterion}</h3>
                <p>{question.text}</p>
              </div>
            ))}
          </Panel>
          <Panel title="Your recorded review">
            <ol className="accs-timeline">
              {recorded.map((line, index) => {
                const split = line.indexOf(": ");
                return (
                  <li key={index}>
                    {split > 0 ? (
                      <>
                        <strong>{line.slice(0, split)}</strong>
                        <p className="ev-comment">{line.slice(split + 2)}</p>
                      </>
                    ) : (
                      <p className="ev-comment">{line}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </Panel>
        </>
      ) : (
        <Panel flush title="Questions">
          {formQuestions.map((question) => (
            <section className="ev-review-q" key={question.id}>
              <div className="ev-q__head">
                <h3>{question.criterion}</h3>
                <p>{question.text}</p>
              </div>
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
          ))}
        </Panel>
      )}
      <ActionError error={action.error} />
      {!readOnly && !savedReview && (
        <div className="ev-submitbar">
          <p>Go through every question, then send.</p>
          <Button loading={action.isPending} onPress={() => void submit()}>
            Send review
          </Button>
        </div>
      )}
    </div>
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

function LoadingSkeleton() {
  return (
    <div
      className="accs-stack"
      role="status"
      aria-label="Loading evaluations"
      aria-busy="true"
    >
      <div className="accs-skeleton" style={{ height: 36, width: "38%" }} />
      <div className="accs-skeleton" style={{ height: 88 }} />
      <div className="accs-grid ev-grid">
        {[0, 1, 2].map((key) => (
          <div className="accs-skeleton" style={{ height: 210 }} key={key} />
        ))}
      </div>
    </div>
  );
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
          <LoadingSkeleton />
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
