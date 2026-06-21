import "./index.css";
import { Composition, getInputProps } from "remotion";
import { MyComposition } from "./Composition";

// We'll define a type for our expected props to make TS happy
export type VideoProps = {
  durationInFrames?: number;
  source_title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  raw_script?: string;
  audio_url?: string;
};

export const RemotionRoot: React.FC = () => {
  // getInputProps() reads from the CLI --props or returns default {} during preview
  const props = getInputProps() as VideoProps;
  
  // Default to 900 frames (30s) if no props are provided (for Remotion Studio preview)
  const durationInFrames = props.durationInFrames || 900;

  return (
    <>
      <Composition
        id="MyVideo"
        component={MyComposition}
        durationInFrames={durationInFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          source_title: props.source_title || "Sample Project Title",
          hook: props.hook || "Sample hook.",
          body: props.body || "Sample body text.",
          cta: props.cta || "Sample cta.",
          raw_script: props.raw_script || "Sample raw script.",
        }}
      />
    </>
  );
};
