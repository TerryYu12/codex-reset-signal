"""Send one notification using Gmail SMTP. Credentials arrive via stdin, never CLI args."""
import json
import smtplib
import ssl
import sys
from email.message import EmailMessage

def main():
    data = json.load(sys.stdin)
    msg = EmailMessage()
    msg["From"] = data["user"]
    msg["To"] = data["to"]
    msg["Subject"] = data["subject"]
    msg.set_content(data["text"])
    msg.add_alternative(data["html"], subtype="html")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=25) as smtp:
        smtp.login(data["user"], data["password"])
        smtp.send_message(msg)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("SMTP send failed; verify Gmail app password and network access.", file=sys.stderr)
        sys.exit(1)
