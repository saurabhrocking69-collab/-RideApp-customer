import * as Sentry from '@sentry/react-native';
import { useEffect, useRef } from 'react';
import { BackHandler, ToastAndroid } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import { Router } from './src/Router';

Sentry.init({
  dsn: 'https://4367c95061c05f0f9a5768bffdd05dec@o4511631997796352.ingest.us.sentry.io/4511632039804933',
  environment: 'production',
  tracesSampleRate: 0.1,
});

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
      <BackHandlerWrapper />
    </AppProvider>
  );
}

export default Sentry.wrap(App);
