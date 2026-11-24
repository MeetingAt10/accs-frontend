import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useId, useState, type CSSProperties } from "react";

import "../app/records.css";

export interface ChartDatum {
  label: string;
  value?: number | null;
  suppressed?: boolean;
  /** Colors the bar: red, yellow or green by severity (QA 19 November). */
  tone?: "danger" | "warn" | "ok";
  /** CSS color for the bar, such as a case stage color (var(--accs-stage-chair)). */
  color?: string;
  [key: string]: unknown;
}

export interface ChartSeries {
  key: string;
  label: string;
}

export interface ChartProps {
  title: string;
  data: ChartDatum[];
  max?: number;
  reference?: number;
  referenceLabel?: string;
  series?: ChartSeries[];
  /** Keep the title for assistive tech only, for charts that sit under a Panel title. */
  hideTitle?: boolean;
  /** Unit after each value, such as "days". */
  unit?: string;
  /** Shown instead of a value when a bar has none (default "No data"). */
  emptyLabel?: string;
}

const ease = [0.16, 1, 0.3, 1] as const;
const view = { once: true, margin: "0px 0px -40px 0px" } as const;

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Number that counts up from zero when it mounts or changes. */
export function CountUp({
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
    (current) =>
      current.toLocaleString("en-PH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + suffix,
  );
  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease });
    return () => controls.stop();
  }, [value, reduce, motionValue]);
  return <motion.span className="accs-num">{text}</motion.span>;
}

/** The chart's values as a table, for readers who want exact numbers or use assistive tech. */
export function DataTable({
  data,
  series,
  rowLabel = "Category",
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  /** Heading of the first column, naming what each row is. */
  rowLabel?: string;
}) {
  return (
    <div className="rc-scroll">
      <table className="accs-table">
        <caption className="rc-sr">Chart values</caption>
        <thead>
          <tr>
            <th scope="col">{rowLabel}</th>
            {series.map((entry) => (
              <th scope="col" className="accs-num" key={entry.key}>
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={entry.label + index}>
              <th scope="row">{entry.label}</th>
              {series.map((column) => (
                <td key={column.key} className="accs-num">
                  {entry.suppressed
                    ? "Suppressed"
                    : entry[column.key] == null
                      ? "No data"
                      : String(entry[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTable({
  data,
  series,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
}) {
  return (
    <details className="ch-data">
      <summary>View as table</summary>
      <DataTable data={data} series={series} />
    </details>
  );
}

function Caption({
  id,
  title,
  hidden,
}: {
  id: string;
  title: string;
  hidden?: boolean;
}) {
  return (
    <figcaption id={id} className={hidden ? "rc-sr" : "ch__title"}>
      {title}
    </figcaption>
  );
}

export function BarChart({
  title,
  data,
  max,
  reference,
  referenceLabel = "Scope average",
  hideTitle,
  unit,
  emptyLabel = "No data",
}: ChartProps) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const suffix = unit ? ` ${unit}` : "";
  const upper = Math.max(
    1,
    max ?? Math.max(0, ...data.map((entry) => number(entry.value))),
  );
  const hasReferences = data.some(
    (entry) => typeof entry.reference === "number",
  );

  return (
    <figure className="ch" aria-labelledby={titleId}>
      <Caption id={titleId} title={title} hidden={hideTitle} />
      {data.length ? (
        <>
          <ul className="ch-bars">
            {data.map((entry, index) => {
              const pct = Math.min(100, (number(entry.value) / upper) * 100);
              const ref =
                typeof entry.reference === "number"
                  ? Math.min(100, (entry.reference / upper) * 100)
                  : null;
              return (
                <li
                  className="ch-bar"
                  key={entry.label + index}
                  data-tone={entry.tone}
                  style={entry.color ? ({ "--bar": entry.color } as CSSProperties) : undefined}
                >
                  <span className="ch-bar__label">{entry.label}</span>
                  {entry.suppressed ? (
                    <>
                      <span className="ch-bar__value ch-bar__value--muted">
                        Suppressed
                      </span>
                      <span className="ch-bar__track ch-bar__track--hatched" />
                    </>
                  ) : (
                    <>
                      <span className="ch-bar__value">
                        {entry.value == null ? (
                          <span className="ch-bar__value--muted">{emptyLabel}</span>
                        ) : (
                          <CountUp
                            value={number(entry.value)}
                            decimals={Number.isInteger(number(entry.value)) ? 0 : 1}
                            suffix={suffix}
                          />
                        )}
                        {typeof entry.reference === "number" && (
                          <span className="ch-bar__ref-text">
                            {referenceLabel}: {entry.reference}
                          </span>
                        )}
                      </span>
                      <span
                        className="ch-bar__track"
                        role="meter"
                        aria-label={entry.label}
                        aria-valuemin={0}
                        aria-valuemax={upper}
                        aria-valuenow={number(entry.value)}
                        aria-valuetext={
                          entry.value == null ? emptyLabel : String(entry.value) + suffix
                        }
                      >
                        <motion.span
                          className="ch-bar__fill"
                          style={{ width: `${pct}%` }}
                          initial={reduce ? false : { scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          viewport={view}
                          transition={{
                            duration: 0.8,
                            ease,
                            delay: Math.min(index, 8) * 0.06,
                          }}
                        />
                        {ref !== null && (
                          <span
                            className="ch-bar__ref"
                            style={{ left: `${ref}%` }}
                            title={`${referenceLabel}: ${entry.reference}`}
                          />
                        )}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {reference !== undefined && (
            <p className="ch__note">
              {referenceLabel}: {reference.toFixed(2)}
            </p>
          )}
          <ChartTable
            data={data}
            series={[
              { key: "value", label: "Value" },
              ...(hasReferences
                ? [{ key: "reference", label: referenceLabel }]
                : []),
            ]}
          />
        </>
      ) : (
        <p className="ch__empty">No data for these filters.</p>
      )}
    </figure>
  );
}

/** Vertical columns: the count above each column, its label below (Figma "Open cases by stage"). `asTable` shows the
 *  same values as a table instead, for a "View as table" switch outside the chart. */
export function ColumnChart({
  title,
  data,
  hideTitle,
  asTable,
  id,
  rowLabel,
}: ChartProps & { asTable?: boolean; id?: string; rowLabel?: string }) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const upper = Math.max(1, ...data.map((entry) => number(entry.value)));
  return (
    <figure className="ch" id={id} aria-labelledby={titleId}>
      <Caption id={titleId} title={title} hidden={hideTitle} />
      {!data.length ? (
        <p className="ch__empty">No data for these filters.</p>
      ) : asTable ? (
        <DataTable data={data} rowLabel={rowLabel} series={[{ key: "value", label: "Cases" }]} />
      ) : (
        <ul className="ch-cols">
          {data.map((entry, index) => (
            <li
              className="ch-col"
              key={entry.label + index}
              style={entry.color ? ({ "--bar": entry.color } as CSSProperties) : undefined}
            >
              {/* Label first for screen readers ("Adviser, 1"); CSS stacks the count on top. */}
              <span className="ch-col__label">{entry.label}</span>
              <span className="ch-col__track" aria-hidden>
                <motion.span
                  className="ch-col__fill"
                  style={{ height: `${(number(entry.value) / upper) * 100}%` }}
                  initial={reduce ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={view}
                  transition={{ duration: 0.7, ease, delay: Math.min(index, 8) * 0.06 }}
                />
              </span>
              <span className="ch-col__value">
                {entry.value == null ? "No data" : <CountUp value={number(entry.value)} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// Series colors from the theme (theme.css): distinct from each other in both light and dark mode.
const colors = [
  "var(--accs-chart-1)",
  "var(--accs-chart-2)",
  "var(--accs-chart-3)",
  "var(--accs-chart-4)",
];

function niceTop(maxValue: number) {
  const raw = Math.max(maxValue, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = Math.max(
    1,
    (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude,
  );
  return { step, top: Math.max(step, Math.ceil(maxValue / step) * step) };
}

// The plot is drawn at the width it gets (measured below) and a fixed height, so lines and labels keep their size on
// wide pages instead of the whole chart scaling up.
const H = 240;
const pad = { l: 40, r: 16, t: 16, b: 30 };
const ph = H - pad.t - pad.b;

export function TrendChart({
  title,
  data,
  series = [{ key: "value", label: "Value" }],
  hideTitle,
}: ChartProps) {
  const titleId = useId();
  const gradient = "g" + useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(480, Math.round(entry.contentRect.width))));
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  const pw = W - pad.l - pad.r;
  const count = data.length;
  const { step, top } = niceTop(
    Math.max(
      0,
      ...data.flatMap((entry) =>
        series.map((column) => number(entry[column.key])),
      ),
    ),
  );
  const x = (index: number) =>
    count > 1 ? pad.l + (index * pw) / (count - 1) : pad.l + pw / 2;
  const y = (value: number) => pad.t + ph - (value / top) * ph;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(count / 6);
  const line = (key: string) =>
    data
      .map(
        (entry, index) =>
          `${index ? "L" : "M"}${x(index)} ${y(number(entry[key]))}`,
      )
      .join(" ");
  const first = series[0];
  const band = count > 1 ? pw / (count - 1) : pw;
  const tipWidth = 150;
  const tipHeight = 26 + series.length * 16;
  const tipX =
    active === null
      ? 0
      : x(active) + 12 + tipWidth > W - pad.r
        ? x(active) - 12 - tipWidth
        : x(active) + 12;
  const summary = data
    .map(
      (entry) =>
        `${entry.label}: ` +
        series
          .map((column) => `${column.label} ${number(entry[column.key])}`)
          .join(", "),
    )
    .join("; ");

  return (
    <figure className="ch" aria-labelledby={titleId}>
      <Caption id={titleId} title={title} hidden={hideTitle} />
      {data.length ? (
        <>
          <ul className="ch-legend" aria-label="Legend">
            {series.map((column, index) => (
              <li key={column.key}>
                <span
                  className="ch-legend__swatch"
                  data-dashed={index % 2 ? "" : undefined}
                  style={{ "--c": colors[index % colors.length] } as CSSProperties}
                />
                {column.label}
              </li>
            ))}
          </ul>
          <div className="rc-scroll" ref={setBox}>
            <svg
              className="ch-plot"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-labelledby={`${titleId}-svg`}
              aria-describedby={`${titleId}-desc`}
              onPointerLeave={() => setActive(null)}
            >
              <title id={`${titleId}-svg`}>{title}</title>
              <desc id={`${titleId}-desc`}>{summary}</desc>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--site-accent)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--site-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="ch-axis">
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line
                      className="ch-grid"
                      x1={pad.l}
                      x2={W - pad.r}
                      y1={y(tick)}
                      y2={y(tick)}
                    />
                    <text x={pad.l - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                      {tick}
                    </text>
                  </g>
                ))}
                {data.map(
                  (entry, index) =>
                    index % labelEvery === 0 && (
                      <text
                        key={entry.label + index}
                        x={x(index)}
                        y={H - 8}
                        textAnchor={
                          count > 1 && index === 0
                            ? "start"
                            : count > 1 && index === count - 1
                              ? "end"
                              : "middle"
                        }
                      >
                        {entry.label}
                      </text>
                    ),
                )}
              </g>
              {first && count > 1 && (
                <motion.path
                  d={`${line(first.key)} L${x(count - 1)} ${y(0)} L${x(0)} ${y(0)} Z`}
                  fill={`url(#${gradient})`}
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={view}
                  transition={{ duration: 0.9, ease, delay: 0.3 }}
                />
              )}
              {active !== null && (
                <line
                  className="ch-rule"
                  x1={x(active)}
                  x2={x(active)}
                  y1={pad.t}
                  y2={pad.t + ph}
                />
              )}
              {series.map((column, si) => (
                <g key={column.key}>
                  {count > 1 && (
                    <motion.path
                      d={line(column.key)}
                      fill="none"
                      stroke={colors[si % colors.length]}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={si % 2 ? "6 5" : undefined}
                      initial={reduce ? false : { pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={view}
                      transition={{ duration: 1, ease, delay: si * 0.15 }}
                    />
                  )}
                  {data.map((entry, index) => (
                    <motion.circle
                      key={entry.label + index}
                      cx={x(index)}
                      cy={y(number(entry[column.key]))}
                      r={active === index ? 5 : 3.5}
                      fill="var(--accs-surface)"
                      stroke={colors[si % colors.length]}
                      strokeWidth={2}
                      initial={reduce ? false : { opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={view}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.04 }}
                    >
                      <title>{`${entry.label} · ${column.label}: ${number(entry[column.key])}`}</title>
                    </motion.circle>
                  ))}
                </g>
              ))}
              {data.map((entry, index) => (
                <rect
                  key={entry.label + index}
                  x={x(index) - band / 2}
                  y={pad.t}
                  width={band}
                  height={ph}
                  fill="transparent"
                  onPointerEnter={() => setActive(index)}
                  onPointerMove={() => setActive(index)}
                />
              ))}
              {active !== null && data[active] && (
                <g
                  className="ch-tip"
                  transform={`translate(${tipX} ${pad.t + 4})`}
                  pointerEvents="none"
                >
                  <rect width={tipWidth} height={tipHeight} rx={8} />
                  <text x={10} y={17} className="ch-tip__title">
                    {data[active]!.label}
                  </text>
                  {series.map((column, si) => (
                    <g key={column.key} transform={`translate(10 ${32 + si * 16})`}>
                      <circle r={3.5} cy={-3} fill={colors[si % colors.length]} />
                      <text x={10}>{column.label}</text>
                      <text x={tipWidth - 20} textAnchor="end" className="ch-tip__val">
                        {number(data[active]![column.key])}
                      </text>
                    </g>
                  ))}
                </g>
              )}
            </svg>
          </div>
          <ChartTable data={data} series={series} />
        </>
      ) : (
        <p className="ch__empty">No data for these filters.</p>
      )}
    </figure>
  );
}
