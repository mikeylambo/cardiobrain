# CardioBrain — Review Loop

Primary viewport: 390 × 844 CSS pixels.
Secondary: 430 × 932.

Required screenshots:
Home, Setup, Countdown, Numbers, Switch, React, Recall, Rhyme Rush, Pause, Results, History, session detail, Settings.

Required interaction review:
- run a real short session in every mode
- verify the stimulus is visible without scrolling
- verify answer pads are one-handed and at least 88px high
- verify safe-area padding does not clip controls
- verify feedback never blocks the next decision
- verify every Recall round is solvable
- verify pause/resume preserves prior trials and resumes through countdown
- verify Results animates without layout shift
- verify History survives reload
- verify audio/haptic failures do not break play
- verify offline navigation still opens the app shell

Reject before done if:
- text truncates unexpectedly
- session scrolls
- a mode generates an unsolvable round
- pause/resume loses state
- any live target is visually smaller than status UI
- the screen feels like a generic dashboard

Playwright review output is evidence. A screenshot that looks wrong is a failing review even when functional assertions are green.

- verify every displayed Recall shape has an identical selectable answer target
- verify Reset app clears history/preferences and returns to first launch
- verify React and Recall challenges advance without freezing after repeated challenge changes
