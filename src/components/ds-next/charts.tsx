import {
  Cell,
  Column,
  Meter,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  ViewState,
} from "@meetingat10/design-system/react";
import { useId } from "react";

export interface ChartDatum {
  label: string;
  value?: number | null;
  suppressed?: boolean;
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
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ChartTable({
  data,
  series,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
}) {
  return (
    <Table aria-label="Chart values">
      <TableHeader>
        <Column isRowHeader>Category</Column>
        {series.map((entry) => (
          <Column key={entry.key} numeric>
            {entry.label}
          </Column>
        ))}
      </TableHeader>
      <TableBody>
        {data.map((entry, index) => (
          <TableRow id={entry.label + index} key={entry.label + index}>
            <Cell>{entry.label}</Cell>
            {series.map((column) => (
              <Cell key={column.key} numeric>
                {entry.suppressed
                  ? "Suppressed"
                  : entry[column.key] == null
                    ? "No data"
                    : String(entry[column.key])}
              </Cell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function BarChart({
  title,
  data,
  max,
  reference,
  referenceLabel = "Scope average",
}: ChartProps) {
  const titleId = useId();
  const upper = Math.max(
    1,
    max ?? Math.max(...data.map((entry) => number(entry.value))),
  );
  const hasReferences = data.some(
    (entry) => typeof entry.reference === "number",
  );

  return (
    <figure aria-labelledby={titleId} tabIndex={0} style={{ margin: 0 }}>
      <figcaption id={titleId} className="ds-section-header__title">
        {title}
      </figcaption>
      {data.length ? (
        <>
          <div
            style={{
              display: "grid",
              gap: "var(--ds-space-16)",
              marginBlock: "var(--ds-space-16)",
            }}
          >
            {data.map((entry) =>
              entry.suppressed ? (
                <p key={entry.label}>
                  {entry.label}: suppressed while the release policy is
                  reviewed.
                </p>
              ) : (
                <Meter
                  key={entry.label}
                  label={entry.label}
                  value={number(entry.value)}
                  minValue={0}
                  maxValue={upper}
                  valueLabel={
                    entry.value == null
                      ? "No data"
                      : String(entry.value) +
                        (typeof entry.reference === "number"
                          ? ` · ${referenceLabel}: ${entry.reference}`
                          : "")
                  }
                />
              ),
            )}
          </div>
          {reference !== undefined && (
            <p>
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
        <ViewState kind="empty" title="No chart data" />
      )}
    </figure>
  );
}

export function TrendChart({
  title,
  data,
  series = [{ key: "value", label: "Value" }],
}: ChartProps) {
  const titleId = useId();
  const upper = Math.max(
    1,
    ...data.flatMap((entry) =>
      series.map((column) => number(entry[column.key])),
    ),
  );
  const point = (entry: ChartDatum, index: number, key: string) => {
    const x = data.length > 1 ? 24 + (index * 552) / (data.length - 1) : 300;
    const y = 176 - (number(entry[key]) * 144) / upper;
    return `${x},${y}`;
  };

  return (
    <figure aria-labelledby={titleId} tabIndex={0} style={{ margin: 0 }}>
      <figcaption id={titleId} className="ds-section-header__title">
        {title}
      </figcaption>
      {data.length ? (
        <>
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label={title}
            style={{ width: "100%", height: "auto" }}
          >
            <line
              x1="24"
              y1="176"
              x2="576"
              y2="176"
              stroke="var(--ds-border-default)"
            />
            {series.map((column, index) => (
              <polyline
                key={column.key}
                points={data
                  .map((entry, entryIndex) =>
                    point(entry, entryIndex, column.key),
                  )
                  .join(" ")}
                fill="none"
                stroke={
                  index % 2
                    ? "var(--ds-text-secondary)"
                    : "var(--ds-text-primary)"
                }
                strokeWidth="3"
                strokeDasharray={index % 2 ? "8 4" : undefined}
              />
            ))}
          </svg>
          <p>
            {series
              .map(
                (column, index) =>
                  `${column.label}${index % 2 ? " (dashed)" : " (solid)"}`,
              )
              .join(" · ")}
          </p>
          <ChartTable data={data} series={series} />
        </>
      ) : (
        <ViewState kind="empty" title="No chart data" />
      )}
    </figure>
  );
}
