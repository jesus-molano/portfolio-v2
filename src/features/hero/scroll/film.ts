/**
 * Timeline layout of the hero film: where each subtitle card sits on the
 * film and how long it needs on screen. Positions are film progress, 0 to
 * 1, the same scale as the camera shots. Inside a shot with subtitles the
 * cards share the shot in proportion to their reading time; without
 * subtitles the film travels at a fixed pace.
 *
 * Layout only. Pacing (how fast the visitor may scrub through the cards)
 * lives in story.ts, which reads these windows and reading times.
 */

export const FILM = {
  /** Reading speed for subtitles, in characters per second. */
  charsPerSecond: 17,
  /** Time to notice a new card and start reading it. */
  findSeconds: 0.6,
  /** No card is shorter than this on screen. */
  minCardSeconds: 1.6,
  /** Fade in and fade out of a card. */
  fadeSeconds: 0.25,
  /** Still frames after a cut before the first card, and between cards. */
  leadInSeconds: 0.5,
  pauseSeconds: 0.35,
  tailSeconds: 0.3,
  /** Natural pace where there is no subtitle (a shot in 2.5 s). */
  travelSpeed: 0.1,
} as const;

/** One line of the script: the shot it plays in and its subtitle cards. */
export type ScriptLine = { shot: number; cards: readonly string[] };

/** One subtitle card on the film. */
export type Beat = {
  /** Where the card starts fading in and where it has faded out. */
  start: number;
  end: number;
  /** Seconds the card needs on screen. */
  seconds: number;
  /** Fraction of the window each fade takes. */
  fade: number;
  /** Index of the script line the card belongs to. */
  line: number;
};

/** A stretch of film with its own speed limit (progress per second). */
export type Segment = { start: number; end: number; speed: number };

export type FilmTimeline = { beats: Beat[]; segments: Segment[] };

/** Per-shot timing overrides, in seconds. */
export type ShotTiming = {
  /** Still frames after the cut before the first card (default FILM.leadInSeconds). */
  leadIn?: number;
  /** Still frames after the last card (default FILM.tailSeconds). */
  tail?: number;
};

export type FilmLayout = {
  shotCount: number;
  /** Subtitles start once the title has gone... */
  captionsFrom: number;
  /** ...and end before the fade to night. */
  captionsTo: number;
  /**
   * Optional timing per shot index: a shot whose move matters more than its
   * words (a reveal) can hold before and after its line.
   */
  shotTiming?: ReadonlyArray<ShotTiming | undefined>;
};

/** Seconds a subtitle card needs on screen to be read comfortably. */
export function readingSeconds(text: string): number {
  // Array.from counts "…" and accented letters as one character each.
  const length = Array.from(text.trim()).length;
  return Math.max(FILM.minCardSeconds, FILM.findSeconds + length / FILM.charsPerSecond);
}

/**
 * Lays the cards out on the film. Each shot that has subtitles becomes one
 * segment: a lead-in after the cut, the cards with short pauses between
 * them, and a tail before the next cut. Inside the segment the film plays
 * at a single speed, chosen so that every card stays up for its reading
 * time; each card's window is proportional to that time.
 */
export function buildTimeline(lines: readonly ScriptLine[], layout: FilmLayout): FilmTimeline {
  const beats: Beat[] = [];
  const segments: Segment[] = [];
  const shotLength = 1 / layout.shotCount;

  for (let shot = 0; shot < layout.shotCount; shot += 1) {
    const cards = lines.flatMap((line, lineIndex) =>
      line.shot === shot ? line.cards.map((text) => ({ text, line: lineIndex })) : [],
    );
    if (cards.length === 0) continue;

    const start = Math.max(shot * shotLength, layout.captionsFrom);
    const end = Math.min((shot + 1) * shotLength, layout.captionsTo);
    const seconds = cards.map((card) => readingSeconds(card.text));
    const leadIn = layout.shotTiming?.[shot]?.leadIn ?? FILM.leadInSeconds;
    const tail = layout.shotTiming?.[shot]?.tail ?? FILM.tailSeconds;
    const total =
      leadIn +
      seconds.reduce((sum, s) => sum + s, 0) +
      FILM.pauseSeconds * (cards.length - 1) +
      tail;
    const speed = (end - start) / total;
    segments.push({ start, end, speed });

    let cursor = start + leadIn * speed;
    cards.forEach((card, i) => {
      const window = seconds[i] * speed;
      beats.push({
        start: cursor,
        end: cursor + window,
        seconds: seconds[i],
        fade: Math.min(0.3, FILM.fadeSeconds / seconds[i]),
        line: card.line,
      });
      cursor += window + FILM.pauseSeconds * speed;
    });
  }

  return { beats, segments };
}

/** Natural pace of the film at a position, in progress per second. */
export function forwardLimit(position: number, timeline: FilmTimeline): number {
  for (const segment of timeline.segments) {
    if (position >= segment.start && position < segment.end) {
      return Math.min(segment.speed, FILM.travelSpeed);
    }
  }
  return FILM.travelSpeed;
}
