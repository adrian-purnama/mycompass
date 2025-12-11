import * as SibApiV3Sdk from '@getbrevo/brevo';

// Initialize Brevo API client
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

/**
 * Send email verification email
 * @param {string} email - User's email address
 * @param {string} token - Verification token
 * @param {string} baseUrl - Base URL of the application
 */
export async function sendVerificationEmail(email, token, baseUrl) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('BREVO_API_KEY not set, skipping email send');
    return;
  }

  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = 'Verify Your Email Address';
  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Thank you for registering! Please click the button below to verify your email address:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationLink}</p>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">This link will expire in 24 hours.</p>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
  sendSmtpEmail.sender = { name: 'MyCompass', email: process.env.BREVO_FROM_EMAIL || 'noreply@mycompass.com' };
  sendSmtpEmail.to = [{ email }];

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Verification email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

/**
 * Send organization invitation email
 * @param {string} email - Invitee's email address
 * @param {string} organizationName - Name of the organization
 * @param {string} inviterEmail - Email of the person sending the invitation
 * @param {string} token - Invitation token
 * @param {string} baseUrl - Base URL of the application
 */
export async function sendInvitationEmail(email, organizationName, inviterEmail, token, baseUrl) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('BREVO_API_KEY not set, skipping email send');
    return;
  }

  const invitationLink = `${baseUrl}/invite?token=${token}`;

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = `You've been invited to join ${organizationName}`;
  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Organization Invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #333;">You've been invited!</h2>
        <p><strong>${inviterEmail}</strong> has invited you to join the organization <strong>${organizationName}</strong> on MyCompass.</p>
        <p>Click the button below to accept the invitation:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${invitationLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; font-size: 12px;">${invitationLink}</p>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">This invitation will expire in 7 days.</p>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
  sendSmtpEmail.sender = { name: 'MyCompass', email: process.env.BREVO_FROM_EMAIL || 'noreply@mycompass.com' };
  sendSmtpEmail.to = [{ email }];

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Invitation email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

