import { NativeModules } from 'react-native';
import { API } from '../api';

/* Truecaller one-tap sign-in.
 *
 * Why it is worth having: it proves a phone number without sending an SMS, so
 * it works with no SMS provider configured and costs nothing per login, and
 * most Indian Android phones already have the app installed.
 *
 * ── The one thing left to wire ──────────────────────────────────────────
 * The bridge below is deliberately reached through NativeModules rather than
 * an `import` of the SDK package. Metro resolves imports at BUNDLE time, so
 * importing a package that is not installed yet would break the build for
 * everyone — including the over-the-air updates that carry unrelated fixes.
 * Read this way, the module is simply absent until a native build includes it,
 * isReady() stays false, and the button never renders. Nothing breaks.
 *
 * To turn it on:
 *   1. Register the app at Truecaller's developer portal, get the Client ID.
 *   2. Set TRUECALLER_CLIENT_ID on the backend (the server-side half is
 *      already live at POST /api/auth/truecaller).
 *   3. Install the SDK package and run a native EAS build.
 *   4. Fill in BRIDGE below with that package's actual module name and method
 *      names, and set the client id in app config.
 * Until step 4 is done this file is inert on purpose — a sign-in button that
 * silently does nothing would be worse than no button.
 */

type TcResult = { authorizationCode: string; codeVerifier: string };

/* This app's own Truecaller credential. Truecaller issues one per Android
   package, so the driver app has a different one — the backend knows both and
   picks by whichever the app names here. Not a secret: it ships inside the APK
   either way, and PKCE is what makes that safe. */
export const CLIENT_ID = 'ixaf8zgtveksnmobfa_yfuaw7avcjzpeldkt9vqvxni';

const BRIDGE: any =
  (NativeModules as any).TruecallerAuth ||
  (NativeModules as any).RNTruecallerSdk ||
  null;

/* Verify EVERYONE, not only people who already have Truecaller installed.
 *
 * With the Truecaller-only option, someone without the app gets nothing and
 * falls back to SMS OTP — which is exactly the path that does not work right
 * now. `OPTION_VERIFY_ALL_USERS` makes Truecaller verify those users too, by
 * placing a missed call to the number (or routing them to its own OTP), and it
 * comes back through this same OAuth flow: same authorizationCode, same
 * backend endpoint, nothing to change server-side.
 *
 * ── The catch, and it is a real one ────────────────────────────────────
 * On Android 8+ that flow wants READ_PHONE_STATE, READ_CALL_LOG and
 * ANSWER_PHONE_CALLS so the SDK can spot the missed call by itself.
 * READ_CALL_LOG sits in a Google Play RESTRICTED permission group: Play only
 * allows it for a short list of core uses — default dialer, caller ID, spam
 * blocking, backup — and "verifying a phone number" is not among them. A ride
 * app asking for it has to fill in a permissions declaration and can very
 * plausibly be refused, which would block the Play release outright.
 *
 * So the flow is selected here, but the permissions are NOT in app.json. See
 * the note there before the next native build. Worth asking Truecaller support
 * whether their manual path — the user typing the last digits of the calling
 * number — works without CALL_LOG, because if it does, this is free. */
export const VERIFY_ALL_USERS = true;

export function isReady(): boolean {
  return !!BRIDGE && typeof BRIDGE.isUsable === 'function' && typeof BRIDGE.requestAuth === 'function';
}

/* Runs the native sheet and hands the result to our own backend.
 *
 * The phone number is never taken from the device. The app only ever forwards
 * an authorization code, and the backend accepts only the number Truecaller's
 * own profile API returns for it. If the app could name the number, this would
 * be a bigger hole than the test-OTP one it replaces.
 *
 * Returns null when the user simply backed out, so the caller can stay quiet;
 * throws with a readable message when something actually failed, so the caller
 * can say so and fall back to OTP. */
export async function signIn(partnerCode?: string): Promise<{ token: string; user: any; phone: string } | null> {
  if (!isReady()) throw new Error('Truecaller is not available on this device.');

  /* With VERIFY_ALL_USERS the sheet is worth opening even when Truecaller is
     not installed — that is the whole point of the fallback — so isUsable() is
     only allowed to veto in the Truecaller-only mode. */
  if (!VERIFY_ALL_USERS) {
    const usable = await BRIDGE.isUsable();
    if (!usable) return null;
  }

  let out: TcResult | null;
  try {
    out = await BRIDGE.requestAuth({ verifyAllUsers: VERIFY_ALL_USERS });
  } catch (_e) {
    return null;                       // user dismissed the sheet
  }
  if (!out || !out.authorizationCode) return null;

  const res = await fetch(`${API}/api/auth/truecaller`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authorizationCode: out.authorizationCode,
      codeVerifier: out.codeVerifier,
      client_id: CLIENT_ID,
      role: 'customer',
      partner_code: partnerCode,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.token) {
    throw new Error((data && data.error) || 'Truecaller sign-in failed. Please use OTP.');
  }
  return { token: data.token, user: data.user, phone: data.phone };
}
