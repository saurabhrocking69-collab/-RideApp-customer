import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import { Router } from './src/Router';

function BackHandlerWrapper() {
  const { screen, setScreen, tab, setTab } = useApp();

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'splash') return true;
      if (screen === 'onboarding') return true;
      if (screen === 'otp') { setScreen('login'); return true; }
      if (screen === 'login') return false; // allow app exit

      // During active ride — block back so user can't accidentally leave
      if (['matching', 'inride', 'payment', 'postride'].includes(screen)) return true;

      if (screen === 'chat') { setScreen('inride'); return true; }

      if (screen === 'home') {
        if (tab !== 'home') { setTab('home'); return true; }
        return false; // home tab → allow minimize
      }

      // All other screens (wallet, rewards, support, complaints, etc.) → home
      setScreen('home');
      return true;
    });
    return () => handler.remove();
  }, [screen, tab]);

  return <Router />;
}

export default function App() {
  return (
    <AppProvider>
      <BackHandlerWrapper />
    </AppProvider>
  );
}
