# Fluxen — Firebase Authentication rollout

Firebase Auth verifies email addresses with a link and handles passwords and password resets. Render keeps issuing a Fluxen API JWT so existing app APIs and device authentication do not change. Firebase-linked sessions are also checked against the Firebase account's current sign-in validity (cached for up to 30 seconds). Supabase PostgreSQL still owns the application user IDs, devices, measurements, usage limits, and billing data. Push notifications still use Expo/FCM.

## Firebase Console

1. Open **project-fluxen → Authentication → Sign-in method** and enable **Email/Password**. The separate passwordless **Email link** provider is not needed. In **Authentication → Templates**, keep Firebase's default action handler for **Email address verification** and **Password reset**. The hosted action page works without an owned domain and no Resend setup is needed.
2. Copy the project Web API key from **Project settings → General**. Use a key for this same project permitted to call the Identity Toolkit API from Render (do not use an Android-only key).
3. In the same Google Cloud project, create a dedicated service account with **Firebase Authentication Viewer** (`roles/firebaseauth.viewer`). It only needs to read account status, not create or modify accounts. Create/download its JSON key yourself and transfer it directly to the Render secret file described below. Do not share it or commit it, and do not replace the existing Expo FCM key.

## Supabase and Render

1. Verify migrations `004_push_subscription.sql` and `006_account_email_security.sql` are already present. Run [007_firebase_auth_link.sql](sql/migrations/007_firebase_auth_link.sql) in the schema used by the backend. It does not delete accounts or change their IDs. Only a successful link later clears that account's old password hash.
2. Deploy the updated backend initially with `FIREBASE_AUTH_ENABLED=false`. In **Render → Environment → Secret Files**, add `fluxen-firebase-auth.json` with the dedicated account JSON. Set:

   ```dotenv
   FIREBASE_AUTH_PROJECT_ID=project-fluxen
   FIREBASE_AUTH_API_KEY=<Web API key from that Firebase project>
   GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/fluxen-firebase-auth.json
   FIREBASE_AUTH_ENABLED=false
   ACCOUNT_EMAIL_ENABLED=false
   REPORT_EMAIL_ENABLED=false
   ```

   Keep the existing database and Fluxen JWT settings. No values need to be added to Expo. Note: after any account is linked, retain the Firebase project, API key, credentials and backend support even if you pause new enrollment.
3. Install the updated APK and verify the Firebase console/template settings and the secret-file path. Use `FIREBASE_AUTH_ENABLED=true` in a test deployment first, then enable it in production after confirming actual email delivery and account ownership. Save and redeploy. Older APKs can still sign in but cannot use the new registration/reset screens.

## Pilot checks

- New account: Register → open the emailed link → return and tap **I've verified my email** → sign in. A local account is not created until Firebase confirmation and the correct password.
- Existing account: Log in normally, then **Profile → Verify your email**. Supply the current Fluxen password, open the email link, and confirm. The new session has the same Fluxen user ID and retains the old device list. No account is linked on address similarity alone. Accounts that have not linked continue using the old login; Firebase reset cannot recover an unlinked legacy account.
- Reset: Request a link and use the Firebase-hosted form. Verify the new password works and the old API session/push subscription is rejected once the short status cache expires.
- Usage history: XLSX still exports/shares in the app; direct email delivery is not included in Firebase Auth.
