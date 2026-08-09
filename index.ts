import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import App from './App';

// children optional: it is passed as createElement's third argument, not in
// the props object, so requiring it here made that call fail to typecheck.
class ErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const e = this.state.error;
      return React.createElement(
        ScrollView,
        {
          style: { flex: 1, backgroundColor: '#fff', padding: 16 },
          contentContainerStyle: { paddingTop: 60 },
        },
        React.createElement(
          Text,
          { style: { color: '#cc0000', fontSize: 18, fontWeight: 'bold', marginBottom: 8 } },
          'App JS Error'
        ),
        React.createElement(
          Text,
          { style: { color: '#333', fontSize: 14, marginBottom: 12 } },
          e.message || String(e)
        ),
        React.createElement(
          Text,
          { style: { color: '#666', fontSize: 11 } },
          (e.stack || '').substring(0, 1200)
        )
      );
    }
    return this.props.children;
  }
}

const Root = () =>
  React.createElement(ErrorBoundary, {}, React.createElement(App));

registerRootComponent(Root);
