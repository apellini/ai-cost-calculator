"""
Optional SMTP email sending. Does nothing if SMTP_HOST is not configured.
All send failures are logged as warnings — never raise to callers.
"""
import logging
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_invite_email(
    to_email: str,
    to_name: str,
    invite_url: str,
    password: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_from: str,
    smtp_tls: bool,
) -> None:
    """Send invite email. No-op if smtp_host is empty."""
    if not smtp_host:
        return
    body = (
        f"Hi {to_name},\n\n"
        f"You've been invited to AI Cost Calculator.\n\n"
        f"Login URL: {invite_url}\n"
        f"Password:  {password}\n\n"
        f"This invite link expires in 24 hours.\n"
        f"After signing in you can change your password in Settings.\n"
    )
    msg = MIMEText(body)
    msg["Subject"] = "Your AI Cost Calculator Invite"
    msg["From"] = smtp_from
    msg["To"] = to_email
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if smtp_tls:
                server.starttls()
            if smtp_user:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info("Invite email sent to %s", to_email)
    except Exception as exc:
        logger.warning("Failed to send invite email to %s: %s", to_email, exc)
