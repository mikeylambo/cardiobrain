import type { ModeViewProps } from "./shared";
import { feedbackFor, Stage, Tiles, usePresentOnPaint } from "./shared";

export function NumbersView({ challenge, onAnswer, onPresented, feedback, entering }: ModeViewProps) {
  usePresentOnPaint(onPresented, challenge.id);
  const fb = feedbackFor(feedback, challenge);
  return (
    <>
      <Stage prompt={challenge.prompt} feedback={fb} entering={entering} />
      <Tiles options={challenge.options} onPick={onAnswer} feedback={fb} disabled={Boolean(fb)} />
    </>
  );
}
