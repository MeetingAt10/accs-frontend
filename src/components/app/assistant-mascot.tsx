import type { CSSProperties } from "react";

// The ACCS lion mascot, the face of the assistant. Sprite sheets come from the landing site's mascot set
// (accs-landing public/landing/mascot/lion), copied to public/assistant/lion at 1x: the largest use here is 96px.
const base = "/assistant/lion/";
const stills = ["neutral", "happy", "laughing", "surprised", "sad", "thinking", "sleepy", "wink", "love", "proud", "wave", "point", "cheer", "document"] as const;
const columns = 7;
const rows = 2;
const breatheFrames = 16;

export type MascotStill = (typeof stills)[number];

/**
 * One pose from the stills sheet, or the looping breathe animation when `still` is left out.
 * Decorative by default; pass `label` to expose it as an image. Reduced motion shows the first frame.
 */
export function AssistantMascot({ still, size = 32, label, className }: { still?: MascotStill; size?: number; label?: string; className?: string }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  const box: CSSProperties = { width: size, height: (size * 275) / 280 };
  if (still) {
    const index = stills.indexOf(still);
    const col = index % columns;
    const row = Math.floor(index / columns);
    return (
      <span
        {...a11y}
        className={["accs-mascot", className].filter(Boolean).join(" ")}
        style={{
          ...box,
          backgroundImage: `url(${base}sheet@1x.png)`,
          backgroundSize: `${columns * 100}% ${rows * 100}%`,
          backgroundPosition: `${(col / (columns - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
        }}
      />
    );
  }
  return (
    <span
      {...a11y}
      className={["accs-mascot accs-mascot--breathe", className].filter(Boolean).join(" ")}
      style={{ ...box, backgroundImage: `url(${base}breathe@1x.png)`, backgroundSize: `${breatheFrames * 100}% 100%`, ["--mascot-frames" as string]: breatheFrames }}
    />
  );
}
