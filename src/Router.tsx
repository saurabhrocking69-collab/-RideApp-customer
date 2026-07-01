import { View } from 'react-native';
import { useApp } from './context/AppContext';
import { OfflineBanner } from './components/OfflineBanner';
import { NotificationToast } from './components/NotificationToast';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen, LoginScreen, OtpScreen } from './screens/AuthScreens';
import { HomeScreen } from './screens/HomeScreen';
import { BookingScreen } from './screens/BookingScreen';
import { MatchingScreen } from './screens/MatchingScreen';
import { InRideScreen } from './screens/InRideScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { PostRideScreen } from './screens/PostRideScreen';
import { ComplaintsScreen, NewComplaintScreen, ComplaintDetailScreen } from './screens/ComplaintsScreens';
import { HourlyScreen } from './screens/HourlyScreen';
import { HourlyInfoScreen } from './screens/HourlyInfoScreen';
import { WalletScreen } from './screens/WalletScreen';
import { PromoScreen } from './screens/PromoScreen';
import { SafetyScreen } from './screens/SafetyScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ReferralScreen, PolicyScreen, SavedPlacesScreen, ChatScreen } from './screens/SimpleScreens';
import { RewardsScreen } from './screens/RewardsScreen';
import { ScheduledRideScreen } from './screens/ScheduledRideScreen';
import { BudgetScreen } from './screens/BudgetScreen';

function ActiveScreen() {
  const { screen } = useApp();
  if (screen === 'splash')           return <SplashScreen />;
  if (screen === 'onboarding')       return <OnboardingScreen />;
  if (screen === 'login')            return <LoginScreen />;
  if (screen === 'otp')              return <OtpScreen />;
  if (screen === 'home')             return <HomeScreen />;
  if (screen === 'booking')          return <BookingScreen />;
  if (screen === 'matching')         return <MatchingScreen />;
  if (screen === 'inride')           return <InRideScreen />;
  if (screen === 'payment')          return <PaymentScreen />;
  if (screen === 'postride')         return <PostRideScreen />;
  if (screen === 'hourly')           return <HourlyScreen />;
  if (screen === 'hourly-info')      return <HourlyInfoScreen />;
  if (screen === 'wallet')           return <WalletScreen />;
  if (screen === 'promo')            return <PromoScreen />;
  if (screen === 'safety')           return <SafetyScreen />;
  if (screen === 'support')          return <SupportScreen />;
  if (screen === 'complaints')       return <ComplaintsScreen />;
  if (screen === 'complaint-new')    return <NewComplaintScreen />;
  if (screen === 'complaint-detail') return <ComplaintDetailScreen />;
  if (screen === 'referral')         return <ReferralScreen />;
  if (screen === 'policy')           return <PolicyScreen />;
  if (screen === 'saved')            return <SavedPlacesScreen />;
  if (screen === 'chat')             return <ChatScreen />;
  if (screen === 'rewards')          return <RewardsScreen />;
  if (screen === 'scheduled')        return <ScheduledRideScreen />;
  if (screen === 'budget')           return <BudgetScreen />;
  return <HomeScreen />;
}

// Global overlays rendered on top of all screens
export function Router() {
  const { notifToast, setNotifToast, screen, setScreen } = useApp();

  const handleNotifTap = (n: typeof notifToast) => {
    if (!n) return;
    if (['ride_matched', 'driver_arrived', 'extension_accepted'].includes(n.type || '')) setScreen('matching');
    else if (n.type === 'trip_started') setScreen('inride');
    else if (n.type === 'trip_completed') setScreen('payment');
    else setScreen('home');
  };

  return (
    <View style={{ flex: 1 }}>
      <ActiveScreen />
      <OfflineBanner />
      <NotificationToast
        notif={notifToast}
        onDismiss={() => setNotifToast(null)}
        onTap={n => { setNotifToast(null); handleNotifTap(n); }}
      />
    </View>
  );
}
