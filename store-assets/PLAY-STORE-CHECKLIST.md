# Sppero (rider app) — Google Play Console submission kit

Everything below is ready to paste into Play Console once your developer account is active.

> ⚠️ **Hard blocker before submitting:** production currently has `ALLOW_TEST_OTP=true`
> on Railway, which (a) leaks the real OTP in the API response and (b) lets `000000`
> log into any phone number with no real verification — a live account-takeover hole.
> This must be disabled, but only *after* real SMS delivery is working, otherwise
> nobody (including you, testers, or the Google reviewer) can log in at all. Plan:
> 1. Sign up for Fast2SMS (or similar) and get an API key.
> 2. Add it as `FAST2SMS_API_KEY` in Railway — the send-otp route already sends real
>    SMS automatically once this is set, no code change needed.
> 3. Test a real login end-to-end, then set `ALLOW_TEST_OTP=false` on Railway.
> Google's reviewer will try to actually sign up during app review — if OTP doesn't
> arrive by real SMS, the app fails review. Do this before uploading the build.

## 1. Assets in this folder
- `hi-res-icon-512.png` — 512x512 store icon
- `feature-graphic-1024x500.png` — store listing banner

Still needed from you (Play Console requires these, can't be generated without a real device/emulator):
- Phone screenshots — minimum 2, recommend 4-8. Use screen recordings/screenshots of: Home screen, Booking screen, Live tracking, Ride complete/rating screen.
- (Optional but recommended) a short promo video URL (YouTube) if you have one.

## 2. Store Listing Text

**App name** (30 char max):
`Sppero: Auto, Bike & Car Rides`

**Short description** (80 char max):
`Book auto, bike, car & intercity rides across your city, instantly.`

**Full description** (4000 char max):
```
Sppero is India's own ride-hailing platform — book autos, bikes, cars and more in seconds, with transparent upfront fares and real drivers you can track live.

WHY SPPERO
• Multiple ride types — Auto, Bike, Car, Luxury, and E-Rickshaw where available
• Upfront fare estimates before you book — no surprises
• Live GPS tracking of your driver from pickup to drop
• In-app chat with your driver during the ride
• Cash or online payment (UPI/card) — your choice
• SOS safety button during every ride

BEYOND DAILY RIDES
• Sppero by the Hour — book a driver for multiple stops, shopping trips or errands
• Intercity rides — one-way or round trip to nearby cities, car only
• Schedule a ride in advance for a fixed pickup time
• Book a ride for someone else — family or friends, even if they don't have the app

SIMPLE & TRANSPARENT
• Wallet for faster checkout and refunds
• Ride history and receipts for every trip
• Referral rewards when you invite friends
• 24x7 in-app support for any issue

Sppero currently operates in Lucknow and is expanding to more cities across India. Download now and experience India ka apna ride platform.
```

## 3. Data Safety form (Play Console → App content → Data safety)

Answer **Yes** — this app collects or shares user data. Declare:

| Data type | Collected? | Shared? | Purpose |
|---|---|---|---|
| Approximate & precise location | Yes | Yes (with matched driver, for the trip only) | App functionality (matching, tracking, ETA) |
| Name | Yes | Yes (with matched driver) | Account, ride coordination |
| Phone number | Yes | Yes (with matched driver) | OTP login, ride coordination |
| Payment info | Yes (via Razorpay) | Yes (Razorpay, payment processor) | Purchases/transactions |
| App activity / in-app messages | Yes | No (kept between matched rider & driver) | Trip coordination |
| Device/other IDs (push token) | Yes | No | Notifications |

- Data encrypted in transit: **Yes**
- Users can request data deletion: **Yes** — via `help@sppero.com` (also stated in Privacy Policy)
- Privacy Policy URL: **https://api.sppero.com/privacy**

## 4. Content Rating questionnaire

Category: **Utility / Travel & Local**. Answer honestly — no violence, gambling, drugs, or adult content. The app does let a rider communicate with their matched driver in-app (chat), so answer "Yes" to user communication, but note it's restricted to matched trip participants only, not open/public. Expected result: **Everyone / PEGI 3** equivalent, same tier as Uber/Ola.

## 5. Permissions used (declare if Play Console asks)
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — to find your pickup point and nearby drivers, and track the ride live.
- `POST_NOTIFICATIONS` — ride status alerts (driver assigned, arrived, trip updates).
- No background location, no camera permission in this app.

## 6. Before you upload — checklist
- [ ] Play Console developer account created & verified (₹1,700 one-time)
- [ ] App created in Play Console, package name `com.sppero.rider`
- [ ] Store listing text + icon + feature graphic + screenshots uploaded
- [ ] Data safety form filled (Section 3 above)
- [ ] Content rating questionnaire completed (Section 4 above)
- [ ] Privacy Policy URL added: `https://api.sppero.com/privacy`
- [ ] Production AAB built (`eas build --platform android --profile production`) and uploaded
- [ ] If this is a brand-new developer account: complete the mandatory closed testing track (12 testers, 14 continuous days) before Google allows a production release — start this as early as possible, it's the biggest time cost in this whole process, not the app itself.
