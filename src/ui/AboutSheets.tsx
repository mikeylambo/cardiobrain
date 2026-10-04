import React from "react";
import { CHANGELOG } from "../changelog";
import { buildReport, clearErrors, readErrors } from "../platform/diagnostics";
import { isNative, shareText } from "../platform/native";
import { useStore } from "../state/store";
import { Sheet } from "./components";

export function WhatsNewSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="What's new" onClose={onClose}>
      <div className="whats-new">
        {CHANGELOG.map((release) => (
          <section key={release.version}>
            <h3 className="t-17">Version {release.version}</h3>
            <ul>
              {release.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/** A plain-text report you read before it goes anywhere: share it, or copy it into an email or issue. */
export function ReportSheet({ onClose }: { onClose: () => void }) {
  const prefs = useStore((s) => s.prefs);
  const history = useStore((s) => s.history);
  const [note, setNote] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [errorCount, setErrorCount] = React.useState(() => readErrors().length);
  const report = buildReport({ note, prefs, history });
  const canShare = isNative || typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setStatus("Copied. Paste it into an email or a GitHub issue.");
    } catch {
      setStatus("Couldn't copy. Select the report below and copy it by hand.");
    }
  };

  return (
    <Sheet title="Report a problem" onClose={onClose}>
      <label className="group-label" htmlFor="report-note">
        What happened?
      </label>
      <textarea
        id="report-note"
        className="report-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What you did, what you expected, what you saw."
      />
      <div className="stack gap-8" style={{ marginTop: 16 }}>
        {canShare && (
          <button className="btn-primary" onClick={() => void shareText("CardioBrain problem report", report)}>
            Share report
          </button>
        )}
        <button className={canShare ? "btn-text" : "btn-primary"} style={canShare ? { alignSelf: "center" } : undefined} onClick={() => void copy()}>
          Copy report
        </button>
        {status && (
          <p className="t-14" role="status">
            {status}
          </p>
        )}
      </div>
      <details className="report-details">
        <summary>What's included</summary>
        <p className="t-14">
          Version, device, your settings and last session, and any errors this device recorded. No history beyond that, and nothing is sent until you share it.
        </p>
        <pre className="report-preview">{report}</pre>
        {errorCount > 0 && (
          <button
            className="btn-text"
            onClick={() => {
              clearErrors();
              setErrorCount(0);
            }}
          >
            Clear the error log ({errorCount})
          </button>
        )}
      </details>
    </Sheet>
  );
}
