import React from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.warn("CardioBrain recovered from an error:", error.message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen ink" style={{ justifyContent: "space-between" }}>
        <div className="stack gap-12" style={{ marginTop: 40 }}>
          <h1 className="display t-40">Something went wrong.</h1>
          <p className="t-17">Your history is safe on this device, and an unfinished session can be resumed from Home.</p>
        </div>
        <button className="btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
