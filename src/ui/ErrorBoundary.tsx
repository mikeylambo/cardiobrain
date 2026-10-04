import React from "react";

interface Props { children: React.ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-frame">
        <div className="empty-state">
          <div className="hero-mark" aria-hidden="true">CB</div>
          <h1 className="section-title">Something reset.</h1>
          <p className="body-copy">Your history is safe. Reload this page and CardioBrain will recover.</p>
          <button className="action-primary" onClick={() => window.location.reload()}>Reload CardioBrain</button>
        </div>
      </main>
    );
  }
}
