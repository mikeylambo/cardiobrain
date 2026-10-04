import React from "react";
import { buildReport, logError } from "../platform/diagnostics";
import { useStore } from "../state/store";

interface State {
  error: Error | null;
  copied: boolean | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, copied: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  private copyReport = async () => {
    try {
      const { prefs, history } = useStore.getState();
      await navigator.clipboard.writeText(buildReport({ note: 'The app showed "Something went wrong."', prefs, history }));
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  componentDidCatch(error: Error): void {
    console.warn("CardioBrain recovered from an error:", error.message);
    logError(error, "render");
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen ink" style={{ justifyContent: "space-between" }}>
        <div className="stack gap-12" style={{ marginTop: 40 }}>
          <h1 className="display t-40">Something went wrong.</h1>
          <p className="t-17">Your history is safe on this device, and an unfinished session can be resumed from Home.</p>
        </div>
        <div className="stack gap-8">
          <button className="btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
          <button className="btn-text" style={{ alignSelf: "center" }} onClick={() => void this.copyReport()}>
            Copy a problem report
          </button>
          {this.state.copied !== null && (
            <p className="t-14" role="status" style={{ textAlign: "center" }}>
              {this.state.copied ? "Copied. Paste it into an email or a GitHub issue." : "Couldn't copy here. After reloading, use Settings, Report a problem."}
            </p>
          )}
        </div>
      </main>
    );
  }
}
