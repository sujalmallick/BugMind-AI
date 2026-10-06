import os
import logging
import threading

logger = logging.getLogger("BugMind")

# How long the background check waits for Azure's final send status.
_DELIVERY_STATUS_TIMEOUT_SECONDS = 120


def _log_delivery_status(poller, kind: str, to_email: str) -> None:
    """
    begin_send() only means Azure accepted the message. The final outcome
    (Succeeded / Failed, with Azure's error) arrives later, so wait for it on
    a background thread and log it without delaying the HTTP response.
    """

    def wait():
        try:
            result = poller.result(timeout=_DELIVERY_STATUS_TIMEOUT_SECONDS) or {}
            status = result.get("status", "Unknown")
            message_id = result.get("id")
            if status == "Succeeded":
                logger.info(f"{kind} email delivered to {to_email} (status={status}, id={message_id})")
            else:
                logger.warning(
                    f"{kind} email NOT delivered to {to_email} "
                    f"(status={status}, id={message_id}, error={result.get('error')})"
                )
        except Exception as e:
            logger.warning(f"{kind} email to {to_email}: could not confirm delivery: {e}")

    threading.Thread(target=wait, name=f"email-status-{kind}", daemon=True).start()


def send_invitation_email(
    to_email: str,
    invite_url: str,
    inviter_name: str,
    target_name: str,
    target_type: str,
    role: str,
) -> bool:
    """
    Sends an invitation email via Azure Communication Services Email.
    Safely degrades if connection string or sender address is not configured.
    """
    connection_string = os.getenv("AZURE_COMMUNICATION_CONNECTION_STRING")
    sender_address = os.getenv("AZURE_COMMUNICATION_SENDER_EMAIL")

    if not connection_string or not sender_address:
        logger.info(
            f"Email dispatch skipped (AZURE_COMMUNICATION_CONNECTION_STRING or SENDER_EMAIL not configured). "
            f"Invite link: {invite_url}"
        )
        return False

    try:
        from azure.communication.email import EmailClient

        client = EmailClient.from_connection_string(connection_string)

        subject = f"You've been invited to join {target_name} on BugMind AI"
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">BugMind AI Collaboration</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">
                <strong>{inviter_name}</strong> has invited you to collaborate on <strong>{target_name}</strong> ({target_type}) as <strong>{role}</strong>.
            </p>
            <div style="margin: 28px 0;">
                <a href="{invite_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                    Accept Invitation
                </a>
            </div>
            <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:</p>
            <p style="color: #2563eb; font-size: 12px; word-break: break-all;">{invite_url}</p>
        </div>
        """

        message = {
            "content": {
                "subject": subject,
                "plainText": f"{inviter_name} has invited you to join {target_name} on BugMind AI: {invite_url}",
                "html": html_content,
            },
            "recipients": {
                "to": [{"address": to_email}],
            },
            "senderAddress": sender_address,
        }

        poller = client.begin_send(message)
        logger.info(f"Invitation email accepted by Azure for {to_email}")
        _log_delivery_status(poller, "Invitation", to_email)
        return True
    except Exception as e:
        logger.warning(f"Error sending invite email to {to_email}: {e}")
        return False


def send_password_reset_email(
    to_email: str,
    reset_url: str,
    user_name: str,
    expire_minutes: int,
) -> bool:
    """
    Sends a password reset email via Azure Communication Services Email.
    Safely degrades if connection string or sender address is not configured.
    """
    connection_string = os.getenv("AZURE_COMMUNICATION_CONNECTION_STRING")
    sender_address = os.getenv("AZURE_COMMUNICATION_SENDER_EMAIL")

    if not connection_string or not sender_address:
        # SECURITY: never log the reset link itself; it grants account access.
        logger.info(
            f"Password reset email skipped for {to_email} "
            f"(AZURE_COMMUNICATION_CONNECTION_STRING or SENDER_EMAIL not configured)."
        )
        return False

    try:
        from azure.communication.email import EmailClient

        client = EmailClient.from_connection_string(connection_string)

        subject = "Reset your BugMind AI password"
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">Reset your password</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello {user_name},</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">
                We received a request to reset the password for your BugMind AI account.
                This link expires in <strong>{expire_minutes} minutes</strong> and can be used once.
            </p>
            <div style="margin: 28px 0;">
                <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                    Reset Password
                </a>
            </div>
            <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:</p>
            <p style="color: #2563eb; font-size: 12px; word-break: break-all;">{reset_url}</p>
            <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
                If you didn't request this, you can safely ignore this email. Your password won't change.
            </p>
        </div>
        """

        message = {
            "content": {
                "subject": subject,
                "plainText": (
                    f"Hello {user_name},\n\nReset your BugMind AI password using this link "
                    f"(expires in {expire_minutes} minutes): {reset_url}\n\n"
                    f"If you didn't request this, ignore this email."
                ),
                "html": html_content,
            },
            "recipients": {
                "to": [{"address": to_email}],
            },
            "senderAddress": sender_address,
        }

        poller = client.begin_send(message)
        logger.info(f"Password reset email accepted by Azure for {to_email}")
        _log_delivery_status(poller, "Password reset", to_email)
        return True
    except Exception as e:
        logger.warning(f"Error sending password reset email to {to_email}: {e}")
        return False
