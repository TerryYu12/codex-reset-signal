# Gmail SMTP setup

1. Enable Google 2-Step Verification and create an app password at https://myaccount.google.com/apppasswords.
2. In GitHub Settings → Secrets and variables → Actions, create `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_TO`.
3. Enable the `Monitor X for reset` workflow and run it manually once.
4. The first run does not send old notifications (`BOOTSTRAP_NOTIFY=false`).
5. A green workflow does not guarantee an email; one is sent only for new matching events.
6. Once verified, delete unused `RESEND_API_KEY` and `EMAIL_FROM` secrets.
7. The `monitor-state` branch must exist; consult upstream README for initial setup.

Gmail takes precedence over Resend when both are configured.
