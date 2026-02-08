// src/services/emailService.ts
// Email service using SendGrid for group invitations
// Optional - gracefully degrades if SendGrid not configured

import sgMail from '@sendgrid/mail';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

// Initialize SendGrid if API key is available
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

interface GroupInviteEmailParams {
  to: string;
  groupName: string;
  inviterName: string;
  inviteLink: string;
  expiresAt?: Date;
}

export const emailService = {
  /**
   * Check if email service is configured and available
   */
  isConfigured(): boolean {
    return !!(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
  },

  /**
   * Send group invite email
   *
   * @param params - Email parameters
   * @returns true if email sent successfully, false otherwise
   */
  async sendGroupInvite(params: GroupInviteEmailParams): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('Email service not configured - skipping invite email', {
        to: params.to,
        groupName: params.groupName,
      });
      return false;
    }

    const { to, groupName, inviterName, inviteLink, expiresAt } = params;

    const expiryText = expiresAt
      ? `This invite expires on ${expiresAt.toLocaleDateString()}.`
      : 'This invite does not expire.';

    const msg = {
      to,
      from: env.SENDGRID_FROM_EMAIL!,
      subject: `${inviterName} invited you to join "${groupName}" on PicAI`,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { color: #6b7280; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Invited!</h1>
            <p><strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on PicAI.</p>
            <p>Click the button below to join and start sharing photos with the group.</p>
            <a href="${inviteLink}" class="button">Join Group</a>
            <p>${expiryText}</p>
            <div class="footer">
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              <p>PicAI - Collaborative Photo Management</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
${inviterName} invited you to join "${groupName}" on PicAI.

Click the link below to join:
${inviteLink}

${expiryText}

If you didn't expect this invitation, you can safely ignore this email.
      `.trim(),
    };

    try {
      await sgMail.send(msg);
      logger.info('Group invite email sent', { to, groupName });
      return true;
    } catch (error) {
      logger.error('Failed to send group invite email', { error, to, groupName });
      return false;
    }
  },
};
