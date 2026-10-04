import type { ModeViewProps } from "./shared";
import { feedbackFor, Stage, Tiles, usePresentOnPaint } from "./shared";

export function NbackView({ challenge, onAnswer, onPresented, feedback, entering }: ModeViewProps) {
  usePresentOnPaint(onPresented, challenge.id);
  const fb = feedbackFor(feedback, challenge);
  return (
    <>
      <Stage cue={challenge.cue} prompt={challenge.prompt} feedback={fb} entering={entering} />
      <Tiles options={challenge.options} onPick={onAnswer} feedback={fb} disabled={Boolean(fb)} variant="label" />
    </>
  );
}
