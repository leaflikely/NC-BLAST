import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/** Inline minimal error boundary — overlay is 1920x1080 OBS overlay, so keep fallback transparent + tiny badge. */
interface EBState {
  error: Error | null;
}
class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode },
  EBState
> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[OverlayErrorBoundary]", error, errorInfo.componentStack);
  }
  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          padding: "4px 8px",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 11,
          borderRadius: 4,
          fontFamily: "sans-serif",
        }}
      >
        overlay error — refresh OBS source
      </div>
    );
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <OverlayErrorBoundary>
      <App />
    </OverlayErrorBoundary>,
  );
}
