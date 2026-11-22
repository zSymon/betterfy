import { Component, type ReactNode } from 'react';

/** Fängt Render-Fehler ab, damit nicht die ganze App weiß wird. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[betterfy] Render-Fehler:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      this.props.fallback ?? (
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <div className="hud mb-3">Fehler</div>
            <p className="max-w-sm text-[14px] text-mute">Hier ist etwas schiefgelaufen: {this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-full border border-line px-4 py-1.5 text-[13px] text-ink hover:border-white/20"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      )
    );
  }
}
