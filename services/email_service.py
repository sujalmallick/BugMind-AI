import os
import logging

logger = logging.getLogger("BugMind")


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

        client.begin_send(message)
        logger.info(f"Invitation email sent to {to_email}")
        return True
    except Exception as e:
        logger.warning(f"Error sending invite email to {to_email}: {e}")
        return False
