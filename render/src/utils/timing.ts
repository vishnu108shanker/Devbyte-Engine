import { VideoProps, SentenceTiming } from '../Root';

export interface BulletTiming {
  index: number;
  sentence: string;
  delay: number;         // Delay in frames relative to Scene 2 start
  duration: number;      // Duration of this bullet sentence in frames
  startFrame: number;    // Absolute frame in video
  endFrame: number;      // Absolute frame in video
  isActive: boolean;     // Whether actively being narrated at current frame
}

export interface ComputedTimeline {
  s1Start: number;
  s1Duration: number;
  s2Start: number;
  s2Duration: number;
  s3Start: number;
  s3Duration: number;
  bullets: BulletTiming[];
}

/**
 * Extracts duration in frames from a generic timing item (seconds, frames, or object).
 */
function parseDurationInFrames(item: any, fps: number): number | null {
  if (typeof item === 'number') {
    if (isNaN(item) || item <= 0) return null;
    // Values <= 60 are considered seconds (e.g. 3.5s). Values > 60 are already in frames.
    return item <= 60 ? Math.round(item * fps) : Math.round(item);
  }

  if (typeof item === 'object' && item !== null) {
    if (typeof item.durationInFrames === 'number' && item.durationInFrames > 0) {
      return Math.round(item.durationInFrames);
    }
    if (typeof item.duration === 'number' && item.duration > 0) {
      return item.duration <= 60 ? Math.round(item.duration * fps) : Math.round(item.duration);
    }
    if (typeof item.endFrame === 'number' && typeof item.startFrame === 'number') {
      return Math.max(1, Math.round(item.endFrame - item.startFrame));
    }
    if (typeof item.end === 'number' && typeof item.start === 'number') {
      const diff = item.end - item.start;
      return diff > 0 ? Math.max(1, Math.round(diff * fps)) : null;
    }
  }

  return null;
}

/**
 * Word count helper to provide fallback proportional timing when explicit metadata is absent.
 */
function countWords(text?: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.max(words.length, 1);
}

/**
 * Dynamically computes scene boundaries and per-bullet sound-synchronized delays
 * from script metadata, with graceful proportional fallback.
 */
export function calculateSceneAndBulletTimings(
  props: VideoProps,
  sentences: string[],
  durationInFrames: number,
  fps: number = 30,
  currentFrame: number = 0
): ComputedTimeline {
  const safeTotalFrames = Math.max(durationInFrames, 90);

  // 1. Gather any raw timing sources from props
  const rawTimings =
    props.sentence_timings ||
    props.sentence_durations ||
    props.metadata?.sentence_timings ||
    props.metadata?.sentence_durations ||
    (Array.isArray(props.timings) ? props.timings : props.timings?.sentences);

  let rawHookDuration: number | null = null;
  let rawBodyDurations: (number | null)[] = [];
  let rawCtaDuration: number | null = null;

  // Check structured props.timings object: { hook?: number, body?: number[] | number, cta?: number }
  if (props.timings && typeof props.timings === 'object' && !Array.isArray(props.timings)) {
    if (props.timings.hook !== undefined) {
      rawHookDuration = parseDurationInFrames(props.timings.hook, fps);
    }
    if (Array.isArray(props.timings.body)) {
      rawBodyDurations = props.timings.body.map((b) => parseDurationInFrames(b, fps));
    } else if (props.timings.body !== undefined) {
      const parsedBody = parseDurationInFrames(props.timings.body, fps);
      if (parsedBody && sentences.length > 0) {
        const perSentence = Math.floor(parsedBody / sentences.length);
        rawBodyDurations = sentences.map(() => perSentence);
      }
    }
    if (props.timings.cta !== undefined) {
      rawCtaDuration = parseDurationInFrames(props.timings.cta, fps);
    }
  }

  // Check array-based timings: [hookSentence, bodySentence1, bodySentence2, ..., ctaSentence]
  if (Array.isArray(rawTimings) && rawTimings.length > 0) {
    const parsedArray = rawTimings.map((t) => parseDurationInFrames(t, fps));

    if (parsedArray.length >= sentences.length + 2) {
      // Full script breakdown: Hook, all body sentences, CTA
      rawHookDuration = parsedArray[0];
      rawBodyDurations = parsedArray.slice(1, 1 + sentences.length);
      rawCtaDuration = parsedArray[1 + sentences.length];
    } else if (parsedArray.length === sentences.length + 1) {
      // Hook + body sentences (CTA is remainder)
      rawHookDuration = parsedArray[0];
      rawBodyDurations = parsedArray.slice(1, 1 + sentences.length);
    } else if (parsedArray.length === sentences.length) {
      // Body sentences only
      rawBodyDurations = parsedArray;
    }
  }

  // 2. Intelligent Word-Weighted Proportional Fallback
  // Audio narration pacing is closely tied to spoken word count.
  const hookWords = countWords(props.hook);
  const bodySentenceWords = sentences.map((s) => countWords(s));
  const ctaWords = countWords(props.cta);
  const totalWords = hookWords + bodySentenceWords.reduce((a, b) => a + b, 0) + ctaWords;

  const fallbackHookFrames = Math.max(30, Math.round((hookWords / totalWords) * safeTotalFrames));
  const fallbackBodyFrames = bodySentenceWords.map((w) =>
    Math.max(20, Math.round((w / totalWords) * safeTotalFrames))
  );
  const fallbackCtaFrames = Math.max(30, Math.round((ctaWords / totalWords) * safeTotalFrames));

  // 3. Resolve Durations with Minimum Guarantees
  let hookDuration = rawHookDuration ?? fallbackHookFrames;
  // Clamp hook between 15% and 40% of total video if metadata is wildly out of scale
  hookDuration = Math.max(30, Math.min(Math.floor(safeTotalFrames * 0.4), hookDuration));

  let ctaDuration = rawCtaDuration ?? fallbackCtaFrames;
  ctaDuration = Math.max(30, Math.min(Math.floor(safeTotalFrames * 0.35), ctaDuration));

  // Available frames for Scene 2 (Body Bullets)
  const remainingForBody = safeTotalFrames - hookDuration - ctaDuration;

  let bodyDurations: number[] = [];
  if (sentences.length === 0) {
    bodyDurations = [];
  } else {
    // Fill each body sentence duration with parsed value or fallback
    const unscaledBodyDurations = sentences.map((_, i) => {
      const parsed = rawBodyDurations[i];
      return parsed && parsed > 0 ? parsed : fallbackBodyFrames[i] || 30;
    });

    const sumUnscaled = unscaledBodyDurations.reduce((a, b) => a + b, 0);

    if (sumUnscaled > 0 && Math.abs(sumUnscaled - remainingForBody) > 15) {
      // Proportionately scale body durations to fill available body frames
      const scaleFactor = remainingForBody / sumUnscaled;
      let allocated = 0;
      bodyDurations = unscaledBodyDurations.map((d, i) => {
        if (i === unscaledBodyDurations.length - 1) {
          return Math.max(20, remainingForBody - allocated);
        }
        const scaled = Math.max(20, Math.round(d * scaleFactor));
        allocated += scaled;
        return scaled;
      });
    } else {
      bodyDurations = unscaledBodyDurations;
    }
  }

  // 4. Calculate Scene Start & Duration Boundaries (Contiguous, zero gaps)
  const s1Start = 0;
  const s1Duration = hookDuration;

  const s2Start = s1Start + s1Duration;
  const s2Duration = bodyDurations.reduce((a, b) => a + b, 0);

  const s3Start = s2Start + s2Duration;
  const s3Duration = Math.max(1, safeTotalFrames - s3Start);

  // 5. Calculate Per-Bullet Delays and Active Narration Status
  let currentDelay = 0;
  const bullets: BulletTiming[] = sentences.map((sentence, index) => {
    const duration = bodyDurations[index] || 30;
    const startFrame = s2Start + currentDelay;
    const endFrame = startFrame + duration;
    const delay = currentDelay;

    // Bullet is active when current playback is within its sentence narration window
    const isActive =
      currentFrame >= startFrame &&
      (index === sentences.length - 1 ? currentFrame < s3Start : currentFrame < endFrame);

    currentDelay += duration;

    return {
      index,
      sentence,
      delay,
      duration,
      startFrame,
      endFrame,
      isActive,
    };
  });

  return {
    s1Start,
    s1Duration,
    s2Start,
    s2Duration,
    s3Start,
    s3Duration,
    bullets,
  };
}
