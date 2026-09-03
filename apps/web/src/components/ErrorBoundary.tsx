import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, any render-time error — most likely a code-split page chunk that fails to
 * load — propagates to the root and React unmounts the entire app, leaving a blank page with
 * nothing to interact with and no indication of what went wrong.
 *
 * This renders a recoverable screen instead, and shows the underlying error text so a problem
 * on a device without usable developer tools can still be reported.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center bg-gray-50 dark:bg-slate-950">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Something went wrong
        </h1>
        <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          The app hit an unexpected error. Reloading usually clears it — your saved data is kept
          on this device and isn't affected.
        </p>

        <button
          onClick={() => {
            try {
              sessionStorage.removeItem('fittrack-chunk-reloaded');
            } catch {
              // ignore
            }
            window.location.reload();
          }}
          className="bg-cyan-600 hover:bg-cyan-700 active:scale-95 transition-transform text-white font-semibold px-6 py-3 rounded-full transition-colors"
        >
          Reload the app
        </button>

        <pre
          className="mt-8 max-w-full overflow-x-auto text-left text-[11px] leading-relaxed p-3 rounded-xl border border-gray-200 dark:border-slate-800"
          style={{ color: 'var(--text-muted)' }}
        >
          {error.message || String(error)}
        </pre>
      </div>
    );
  }
}
