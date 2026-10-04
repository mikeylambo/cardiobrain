import React from "react";
import { sfx } from "../audio/synth";
import { haptics } from "../haptics";
import type { ModeViewProps } from "./shared";
import { feedbackFor, Stage, Tiles, usePresentOnPaint } from "./shared";

export function SwitchView({ challenge, onAnswer, onPresented, feedback, entering }: ModeViewProps) {
  usePresentOnPaint(onPresented, challenge.id);
  const fb = feedbackFor(feedback, challenge);
  const switched = Boolean(challenge.switchTrial);
  React.useEffect(() => {
    if (switched) {
      sfx.switch();
      haptics.switch();
    }
  }, [challenge.id, switched]);
  return (
    <>
      <Stage feedback={fb} entering={entering} prompt={challenge.prompt}>
        <p key={challenge.id} className={`rule-banner${switched ? " wipe switched" : ""}`}>
          {switched && <span className="sr-only">Rule changed: </span>}
          {challenge.cue}
        </p>
      </Stage>
      <Tiles options={challenge.options} onPick={onAnswer} feedback={fb} disabled={Boolean(fb)} variant="label" />
    </>
  );
}
