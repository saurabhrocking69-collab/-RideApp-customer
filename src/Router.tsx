import { View, Animated, StyleSheet } from 'react-native';
import { useApp } from './context/AppContext';
import { C } from './styles';
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
import { HourlyScreen } from './screens/HourlyScreen';
import { HourlyInfoScreen } from './screens/HourlyInfoScreen';
import { WalletScreen } from './screens/WalletScreen';
import { PromoScreen } from './screens/PromoScreen';
import { SafetyScreen } from './screens/SafetyScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ReferralScreen, PolicyScreen, SavedPlacesScreen, ChatScreen } from './screens/SimpleScreens';
import { RewardsScreen } from './screens/RewardsScreen';
import { BudgetScreen } from './screens/BudgetScreen';
import { SurgePricingScreen } from './screens/SurgePricingScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { TierScreen } from './screens/TierScreen';
import { NewTicketScreen, TicketListScreen } from './screens/TicketScreens';

function ActiveScreen() {
  const { screen } = useApp();
  if (screen === 'splash')           return null;
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
if (screen === 'referral')         return <ReferralScreen />;
  if (screen === 'policy')           return <PolicyScreen />;
  if (screen === 'saved')            return <SavedPlacesScreen />;
  if (screen === 'chat')             return <ChatScreen />;
  if (screen === 'rewards')          return <RewardsScreen />;
  if (screen === 'budget')           return <BudgetScreen />;
  if (screen === 'surge')            return <SurgePricingScreen />;
  if (screen === 'insights')         return <InsightsScreen />;
  if (screen === 'tier')             return <TierScreen />;
  if (screen === 'tickets')          return <TicketListScreen />;
  if (screen === 'ticket-new')       return <NewTicketScreen />;
  return <HomeScreen />;
}

// Global overlays rendered on top of all screens
export function Router() {
  const { notifToast, setNotifToast, screen, setScreen, splashFade, splashDone } = useApp();

  const handleNotifTap = (n: typeof notifToast) => {
    if (!n) return;
    if (['ride_matched', 'driver_arrived', 'extension_accepted'].includes(n.type || '')) setScreen('matching');
    else if (n.type === 'trip_started') setScreen('inride');
    else if (n.type === 'trip_completed') setScreen('payment');
    else if (['support_reply', 'support_resolved'].includes(n.type || '')) setScreen('tickets');
    else setScreen('home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ActiveScreen />
      <OfflineBanner />
      <NotificationToast
        notif={notifToast}
        onDismiss={() => setNotifToast(null)}
        onTap={n => { setNotifToast(null); handleNotifTap(n); }}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: splashFade }]}
        pointerEvents={splashDone ? 'none' : 'auto'}
      >
        <SplashScreen />
      </Animated.View>
    </View>
  );
}
