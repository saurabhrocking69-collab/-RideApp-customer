import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Animated, Text, TouchableOpacity } from 'react-native';
import * as Updates from 'expo-updates';
import { C } from '../styles';

/* "Update ready — tap to restart".
 *
 * The app is configured `checkAutomatically: ON_LOAD` with
 * `fallbackToCacheTimeout: 0`, which means it never waits: it starts on the JS
 * it already has and pulls the new bundle in the background. Nothing then
 * applies it, so the new code only ran on the NEXT cold start — and since
 * backgrounding an app on Android usually does not kill the process, "next
 * cold start" could be days away.
 *
 * The effect was that a shipped fix looked like it had not shipped. Someone
 * would install, open, see the old screen, and reasonably conclude the update
 * had failed. Nothing told them an update was sitting there, downloaded and
 * one restart away.
 *
 * `isUpdatePending` is true only once a new bundle is fully downloaded and
 * verified, so this bar never appears while a download might still fail.
 *
 * The restart is the customer's tap, not automatic: reloadAsync() tears down
 * the JS context, and doing that unannounced mid-booking would look like a
 * crash. `hold` lets a caller suppress the offer entirely during a stretch
 * where a restart would lose something.
 */
/* Launch ke alawa bhi poochho.

   `checkAutomatically: ON_LOAD` sirf launch par poochhta hai. Driver ka app
   ghanton khula rehta hai aur Android us process ko maarta nahi - to launch ke
   baad wo dobara poochhta hi nahi, aur ek poori shift bina jaanch ke nikal
   jaati hai. Naapa gaya: teen update publish ho chuke the, Expo unhe de bhi
   raha tha, aur app purane par hi khada tha.

   Sirf poochhna aur utaarna. Lagana aadmi ke tap par hi rehta hai. */
function useUpdateWatch() {
  useEffect(() => {
    if (!Updates.isEnabled) return;   // dev aur Expo Go me kuch nahi karna
    let dead = false;
    const look = async () => {
      try {
        const r = await Updates.checkForUpdateAsync();
        if (!dead && r.isAvailable) await Updates.fetchUpdateAsync();
      } catch (_e) { /* net nahi hai ya server chup hai - agli baar */ }
    };
    const sub = AppState.addEventListener('change', s => { if (s === 'active') look(); });
    const iv = setInterval(look, 15 * 60 * 1000);
    look();
    return () => { dead = true; sub.remove(); clearInterval(iv); };
  }, []);
}

export function UpdateBanner({ hold = false }: { hold?: boolean }) {
  useUpdateWatch();
  const { isUpdatePending } = Updates.useUpdates();
  const [busy, setBusy] = useState(false);
  const slide = useRef(new Animated.Value(-60)).current;

  // Updates.isEnabled is false in dev and in Expo Go, where reloadAsync would
  // do nothing useful — so the bar simply never shows there.
  const show = Updates.isEnabled && isUpdatePending && !hold;

  // In an effect, not in render: starting an animation while rendering fires it
  // again on every re-render, and this sits under a screen that re-renders on
  // every GPS tick.
  useEffect(() => {
    if (show) Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }).start();
    else slide.setValue(-60);
  }, [show]);

  if (!show) return null;

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Reload can fail (no launchable update, storage). Give the control back
      // rather than leaving a spinner that never resolves.
      setBusy(false);
    }
  };

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 998,
      transform: [{ translateY: slide }],
    }}>
      <TouchableOpacity
        onPress={apply}
        activeOpacity={0.85}
        style={{
          backgroundColor: C.green,
          paddingTop: 46, paddingBottom: 9, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          elevation: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
        }}
      >
        {busy
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
              ⬆️  Update ready — tap to restart
            </Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}
