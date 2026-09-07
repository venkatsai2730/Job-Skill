import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors anywhere below it so a single component crash shows a
 *  recoverable fallback instead of a blank white screen (React unmounts the whole
 *  tree to root on an uncaught render error). */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-white-60 text-sm">
              This page hit an unexpected error and couldn't render. Reloading usually fixes it.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="bg-blue-electric hover:bg-blue-bright text-primary-foreground text-sm px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
