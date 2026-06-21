import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { RepoTitle } from './components/RepoTitle';
import { CodePanel } from './components/CodePanel';
import { SubtitleBar } from './components/SubtitleBar';
import { VideoProps } from './Root';

export const MyComposition: React.FC<VideoProps> = (props) => {
  const title = props.source_title || "Sample Project Title";
  const summary = props.body || "This is a great sample summary that will scroll inside the code panel.";
  const script = props.raw_script || "This is a sample hook. This is a sample body. Check it out!";

  // Base background radial gradient
  const backgroundStyle: React.CSSProperties = {
    background: 'radial-gradient(circle at center, #1e1e1e 0%, #0d0d0d 100%)',
  };

  // Inline SVG Noise Texture
  const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

  return (
    <AbsoluteFill style={backgroundStyle}>
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: noiseSvg,
          pointerEvents: 'none',
        }}
      />
      <RepoTitle title={title} />
      <CodePanel text={summary} title={`${title.split('/').pop() || 'script'}.ts`} />
      <SubtitleBar text={script} />
      {props.audio_url && <Audio src={staticFile(props.audio_url)} />}
    </AbsoluteFill>
  );
};
