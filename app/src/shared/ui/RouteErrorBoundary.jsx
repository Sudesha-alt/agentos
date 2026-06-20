import { Component } from "react";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-app border border-danger/30 bg-danger/5 px-6 py-10 text-center">
          <p className="type-kicker text-danger">Load error</p>
          <h1 className="mt-2 text-lg font-semibold text-app-ink">Could not load this page</h1>
          <p className="mt-2 text-[14px] text-app-ink-dim">
            {this.state.error instanceof Error
              ? this.state.error.message
              : "Something went wrong loading this view."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex rounded-app-sm border border-app-border bg-app-surface px-4 py-2 text-[13px] font-medium text-app-ink hover:border-indigo/30"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
