/**
 * ErrorBoundary — stops a single render-time exception from blanking the whole
 * SPA. Two modes: the top-level one (full-page, reload) wraps the entire app;
 * a compact one wraps <Routes> keyed by path, so a broken view shows an inline
 * message while the app chrome (nav, now-playing) stays, and navigating away
 * (which remounts it via the key) recovers automatically.
 */
import React from "react";
import { getUILang } from "../i18n";

type Props = { children: React.ReactNode; compact?: boolean };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const ar = getUILang() === "ar";
    const compact = this.props.compact;
    return (
      <div
        style={{
          minHeight: compact ? "50vh" : "70vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden>
            ۞
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
            {ar ? "حدث خطأٌ غير متوقّع" : "Something went wrong"}
          </h2>
          <p className="muted" style={{ margin: "0 0 18px", lineHeight: 1.7 }}>
            {ar
              ? "نعتذر عن هذا. أعد المحاولة، فإن تكرّر فأعد تحميل الصفحة."
              : "Sorry about that. Try again, or reload the page if it persists."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {compact && (
              <button className="chip" onClick={() => this.setState({ hasError: false })}>
                {ar ? "إعادة المحاولة" : "Try again"}
              </button>
            )}
            <button className="primary" onClick={() => window.location.reload()}>
              {ar ? "إعادة التحميل" : "Reload"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
