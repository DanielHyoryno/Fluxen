# XLSX report email

New registrations verify a six-digit email code before the account is created when account email is enabled. Existing accounts can keep signing in and verify once from Profile. The same verified address allows password recovery and XLSX delivery; downloading still works without verification. Usage-limit alerts are not sent by email.

To enable actual email outside the mocked UI test:

1. On a database already using migration `004_push_subscription.sql`, apply migrations `005_report_email_verification.sql` and `006_account_email_security.sql` in the backend's configured schema. The backend role needs access to the RLS-enabled tables.
2. Configure a separate random `REPORT_EMAIL_OTP_SECRET` of at least 32 characters, the server-only `RESEND_API_KEY`, and `REPORT_EMAIL_FROM` as a sender on your configured Resend domain. Do not put secrets in Expo variables.
3. Distribute the updated mobile app before enabling `ACCOUNT_EMAIL_ENABLED=true`: older clients do not handle the new registration challenge and may misreport account creation. Enable `REPORT_EMAIL_ENABLED=true` separately for XLSX attachments. Keep both flags off until the migration and sender setup are verified.
4. Test with an account and recipient you control. A success response acknowledges submission to the provider, not inbox delivery. Production account verification is not pre-seeded.

The report endpoint takes device and date range only, never an email address; it uses the verified address of the account and the existing ownership-checked XLSX exporter. OTPs expire in 10 minutes, have a resend cooldown of 60 seconds and allow at most five attempts per code. No OTP is returned by the API.

Reset requests return an acknowledgement whether or not the email matches a verified account. A successful code check issues a separate short-lived, single-use reset token. Completing the reset invalidates existing JWT sessions and detaches the old push subscription. Any JWTs signed before the account email rollout remain valid until their normal expiry unless the account's password is reset.

For an email-free preview, run Expo Web with the visual test settings in `mobile/tests/visual/README.md`, then run `node tests/visual/run-account-email-preview.cjs` or `node tests/visual/run-report-email-preview.cjs` within `mobile`. The fixtures use `contoh@fluxen.test` and `123456`, intercept the network and write screenshots to `mobile/coverage/ui-review/`.
