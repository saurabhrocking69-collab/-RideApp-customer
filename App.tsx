import { Component, ReactNode, useEffect, useRef } from 'react';
import { BackHandler, ToastAndroid, View, Text, TouchableOpacity } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import { Router } from './src/Router';

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[Sppero] Crash:', error.message, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.crashed) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 56 }}>😵</Text>
          <Text style={{ color: '#F1F5F9', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>
            Kuch gadbad ho gayi
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            App mein ek choti problem aayi. Dobara try karo.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ crashed: false })}
            style={{ marginTop: 28, backgroundColor: '#E91E63', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Dobara Try Karo</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function BackHandlerWrapper() {
  const { screen, setScreen, tab, setTab, rideData, hourlyStep } = useApp();
  const lastBackRef = useRef(0);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'splash') return true;
      if (screen === 'onboarding') return true;
      if (screen === 'otp') { setScreen('login'); return true; }

      // During active standard ride — block accidental back
      if (['matching', 'inride', 'payment', 'postride'].includes(screen)) return true;

      if (screen === 'chat') {
        setScreen(rideData?.status === 'started' ? 'inride' : 'matching');
        return true;
      }

      if (screen === 'hourly') {
        if (hourlyStep !== 'book') return true; // active/waiting/done — block back
        setScreen('home');
        return true;
      }

      if (screen === 'home') {
        if (tab !== 'home') { setTab('home'); return true; }
        // Double-tap to exit
        const now = Date.now();
        if (now - lastBackRef.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackRef.current = now;
        ToastAndroid.show('Ek baar aur dabao exit ke liye', ToastAndroid.SHORT);
        return true;
      }

      if (screen === 'login') {
        const now = Date.now();
        if (now - lastBackRef.current < 2000) { BackHandler.exitApp(); return true; }
        lastBackRef.current = now;
        ToastAndroid.show('Ek baar aur dabao exit ke liye', ToastAndroid.SHORT);
        return true;
      }

      // All other screens → home
      setScreen('home');
      return true;
    });
    return () => handler.remove();
  }, [screen, tab, rideData?.status, hourlyStep]);

  return <Router />;
}

function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <BackHandlerWrapper />
      </ErrorBoundary>
    </AppProvider>
  );
}

export default App;
