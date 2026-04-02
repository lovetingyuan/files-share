/**
 * Email utilities using Resend API
 */

export interface SendVerificationEmailOptions {
  to: string;
  verificationToken: string;
  appUrl: string;
}

/**
 * Send verification email via Resend API
 */
export async function sendVerificationEmail(
  options: SendVerificationEmailOptions,
  resendApiKey: string,
  senderEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const { to, verificationToken, appUrl } = options;

  // Include email as query param so frontend can extract it
  const encodedEmail = encodeURIComponent(to);
  const verificationUrl = `${appUrl}/verify/${verificationToken}?email=${encodedEmail}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [to],
      subject: "Verify your email address",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f9f9f9; border-radius: 10px; padding: 30px; margin-top: 20px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Verify Your Email</h1>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for registering! Please click the button below to verify your email address.
            </p>
            <p style="margin-bottom: 20px;">
              <a href="${verificationUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify Email
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend API error:", error);
    return { success: false, error: "Failed to send email" };
  }

  return { success: true };
}
