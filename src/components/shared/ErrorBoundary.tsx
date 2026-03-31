"use client";

import React from "react";

import styles from "./ErrorBoundary.module.scss";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable error boundary that catches rendering errors in its subtree
 * and displays a friendly fallback UI instead of crashing the app.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.container}>
          <div className={styles.icon}>!</div>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.message}>
            An unexpected error occurred while rendering this page.
            You can try again or return to the dashboard.
          </p>
          <div className={styles.actions}>
            <button className="btn btn-primary" onClick={this.handleReset}>
              Try Again
            </button>
            <button className="btn btn-secondary" onClick={this.handleReload}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
