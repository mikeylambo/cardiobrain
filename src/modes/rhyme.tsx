import type { ModeViewProps } from "./shared";
import { feedbackFor, Stage, Tiles, usePresentOnPaint } from "./shared";
import { FitText } from "../ui/components";

export function RhymeView({ challenge, onAnswer, onPresented, feedback, entering }: ModeViewProps) {
  usePresentOnPaint(onPresented, challenge.id);
  const fb = feedbackFor(feedback, challenge);
  const { type, shown } = challenge.data as { type: string; shown: string[] };
  return (
    <>
      {type === "chain" ? (
        <Stage cue={challenge.cue} feedback={fb} entering={entering}>
          <div className="chain">
            {shown.map((w) => (
              <FitText key={w} text={w} max={72} className="stimulus display" />
            ))}
            <FitText text="?" max={72} className={`stimulus display${fb?.correct ? " breath" : ""}`} />
          </div>
        </Stage>
      ) : (
        <Stage cue={challenge.cue} prompt={challenge.prompt} feedback={fb} entering={entering} max={type === "odd" ? 96 : 160} />
      )}
      <Tiles options={challenge.options} onPick={onAnswer} feedback={fb} disabled={Boolean(fb)} variant="word" />
    </>
  );
}
