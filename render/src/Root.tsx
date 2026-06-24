import './index.css';
import React from 'react';
import { Composition, getInputProps } from 'remotion';
import { FreeAlternative } from './templates/FreeAlternative';

/**
 * VideoProps — the full schema of data passed from validated_script.json + render.js props.json
 */
export type VideoProps = {
  // Core pipeline fields
  durationInFrames?: number;
  source_title?: string;
  category?: string;
  hook?: string;
  body?: string;
  cta?: string;
  raw_script?: string;
  audio_url?: string;
  // V2 enriched fields from gemini.py
  title?: string;
  description?: string;
  hashtags?: string[];
  thumbnail_text?: string;
  pinned_comment?: string;
  source_url?: string;
  word_count?: number;
};

/**
 * Map category strings to the correct composition component.
 * All resolve to FreeAlternative for now — visual variants can diverge later.
 */
const TEMPLATE_MAP: Record<string, React.FC<VideoProps>> = {
  free_alternative:  FreeAlternative,
  productivity:      FreeAlternative,
  weekly_roundup:    FreeAlternative,
  comparison:        FreeAlternative,
  hidden_gem:        FreeAlternative,
  update:            FreeAlternative,
  best_for:          FreeAlternative,
  prompt_trick:      FreeAlternative,
};

/**
 * RemotionRoot — registers one Composition per template type.
 * Props flow from props.json (written by render.js before invoking remotion).
 */
export const RemotionRoot: React.FC = () => {
  const inputProps = getInputProps() as VideoProps;
  const durationInFrames = inputProps.durationInFrames ?? 900;

  return (
    <>
      {Object.entries(TEMPLATE_MAP).map(([id, Component]) => {
        // Convert snake_case to PascalCase for the composition ID
        const compositionId = id
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('');

        return (
          <Composition
            key={compositionId}
            id={compositionId}
            component={Component}
            durationInFrames={durationInFrames}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              ...inputProps,
              durationInFrames,
            }}
          />
        );
      })}
    </>
  );
};
