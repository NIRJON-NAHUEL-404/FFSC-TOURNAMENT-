import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
          errorMessage = "You don't have permission to perform this action. Please make sure you are logged in as an admin.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-fire-dark flex items-center justify-center p-4">
          <div className="bg-fire-red/20 border border-fire-red p-6 rounded-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-fire-yellow mb-4">System Error</h2>
            <p className="text-white/80 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-fire-orange hover:bg-fire-red text-white px-6 py-2 rounded-lg transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
