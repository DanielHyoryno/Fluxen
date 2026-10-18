# Android push notifications (Expo + FCM V1)

Supabase remains the PostgreSQL database. FCM V1 credentials belong in EAS, not in this repository or Render. The Firebase Android package must be `com.danielhyoryno.fluxen`.

## Rollout

1. Check the target database and users-table access first. If Supabase `anon`/`authenticated` can SELECT users without RLS, stop: verify that the backend DB role bypasses RLS or owns the table, obtain approval, and secure users-table access before storing phone tokens. Migration `004_push_subscription.sql` deliberately refuses this unsafe state; it does not change security policies automatically.
2. Apply `sql/migrations/004_push_subscription.sql` using the intended schema/search_path. This additive migration adds only `users.push_subscription` and a unique index; it does not delete existing data.
3. Deploy the backend, then set `PUSH_NOTIFICATIONS_ENABLED=true` in Render. Default is false for safe rollout. If EAS enhanced push security is enabled, set its `EXPO_ACCESS_TOKEN` on the backend only (never EXPO_PUBLIC_*).
4. Build/install the new Android APK with `google-services.json` and FCM V1 credentials configured in EAS. Existing APKs do not register a push token.
5. Sign in, grant notification permission, then generate a NEW usage-limit alert through non-empty telemetry. Saving a lower limit alone does not reevaluate historical usage.
6. Test foreground, background, locked screen, swipe-away, denied/re-enabled permission, logout, account switching, and duplicate telemetry. Android Force stop requires reopening the app.

## Contract and limits

- `PUT /api/v1/notifications/push-token`: Bearer user JWT; `{ "token": "ExpoPushToken[...]", "locale": "id" }`. One phone per user, last registration wins. Registering the same phone on another account detaches its old account. Subscription expires with the JWT.
- `DELETE /api/v1/notifications/push-token`: Bearer user JWT; `{ "token": "ExpoPushToken[...]" }`. Deletes only the matching user's matching token, so an old phone cannot remove a new phone's subscription.
- The single JSON column holds token, locale, and session expiry. Tokens are not included in public user/device responses.
- Pushes are queued only AFTER telemetry COMMIT. Up to two concurrent sends, three attempts for transient failures, 8-second request timeout. Failure cannot roll back measurements.
- Queue and delayed receipt checks are bounded and IN MEMORY, not a durable outbox. A restart can lose pending sends/receipt checks; there is no exactly-once guarantee or guaranteed delivery time. Provider acceptance is not proof that a user saw the message.
- Expo receipts are checked after 15 minutes while the process stays alive. DeviceNotRegistered disables only the matching subscription. Render sleep/restarts can interrupt these checks.
- Local 15-second notification polling is removed to avoid local/push duplicates. Screens still refresh their in-app alerts normally. Old alerts are not automatically pushed on app launch.
- Registration retries on foreground/token change; permission can be rechecked after returning from Android settings. No background JS polling is required.
- Logout waits for revocation of a stored token. On network/server failure it stays signed in and shows a retry message rather than claiming the phone was detached. Already-dispatched OS notifications cannot be recalled reliably.
- Offline ESP32, delayed telemetry, backend downtime, network conditions, notification permission/channel settings, and Android policies still affect delivery.

No firmware changes are required for push delivery. Never commit Firebase Admin SDK private JSON keys.
