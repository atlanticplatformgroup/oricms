import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert } from '@mantine/core';

export class WorkspaceFeatureBoundary extends Component<
  { title: string; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { title: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[WorkspaceFeatureBoundary:${this.props.title}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert color="red" title={`${this.props.title} failed to render`}>
          Something went wrong in this panel. Refresh and try again.
        </Alert>
      );
    }

    return this.props.children;
  }
}
