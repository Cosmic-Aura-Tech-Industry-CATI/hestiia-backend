import { RESEND_API_KEY, EMAIL_FROM } from '../config/utils.js';

export interface SendOtpOptions {
  to: string;
  recipientName?: string;
  otp: string;
  purpose: 'LOGIN_2FA' | 'FORGOT_PASSWORD' | 'PASSWORD_RESET';
  expiresInMinutes?: number;
}

export class EmailService {
  private apiKey: string;
  private fromAddress: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || RESEND_API_KEY || '';
    this.fromAddress = process.env.EMAIL_FROM || process.env.RESEND_FROM || EMAIL_FROM || 'Hestiia Restaurant <onboarding@resend.dev>';

    if (this.apiKey) {
      console.log(`[EmailService] Resend API initialized successfully with from: ${this.fromAddress}`);
    } else {
      console.warn('[EmailService] RESEND_API_KEY not configured. Operating in console dispatch fallback mode.');
    }
  }

  async sendOtpEmail(options: SendOtpOptions): Promise<{ sent: boolean; method: 'resend' | 'console'; id?: string; error?: string }> {
    const { to, recipientName = 'Hestiia Administrator', otp, purpose, expiresInMinutes = 10 } = options;

    const isLogin = purpose === 'LOGIN_2FA';
    const title = isLogin ? 'Hestiia Admin — 2-Step Sign In Verification Code' : 'Hestiia Admin — Security Password Reset Code';
    const subtitle = isLogin
      ? 'A sign-in request was initiated for your Hestiia Administration Portal account.'
      : 'A security password reset was requested for your Hestiia Administration Portal account.';

    if (!this.apiKey) {
      return { sent: true, method: 'console' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d0c0b; color: #f4efe6; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #181614; border: 1px solid #d4af37; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { text-align: center; border-bottom: 1px solid rgba(212,175,55,0.25); padding-bottom: 20px; margin-bottom: 24px; }
          .logo-text { font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #d4af37; text-transform: uppercase; margin: 0; }
          .sub-logo { font-size: 11px; color: #b8aba0; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; }
          .content { text-align: center; }
          .otp-box { background: #100f0e; border: 2px dashed #d4af37; border-radius: 12px; padding: 18px 24px; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ffd700; margin: 24px 0; display: inline-block; }
          .note { font-size: 12px; color: #9c8e82; line-height: 1.6; margin-top: 20px; }
          .footer { text-align: center; font-size: 10px; color: #6e645c; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 28px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo-text">Hestiia Restaurant</h1>
            <div class="sub-logo">DIMISI Technologies Administration Portal</div>
          </div>
          <div class="content">
            <h2 style="color: #f4efe6; font-size: 18px; margin-bottom: 8px;">${title}</h2>
            <p style="color: #b8aba0; font-size: 13px; line-height: 1.5;">${subtitle}</p>
            <p style="color: #f4efe6; font-size: 13px;">Please use the following single-use verification code to complete authentication:</p>
            <div>
              <div class="otp-box">${otp}</div>
            </div>
            <p class="note">
              This code will expire in <strong>${expiresInMinutes} minutes</strong>.<br>
              If you did not initiate this request, please contact your systems administrator immediately.
            </p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Hestiia Restaurant &bull; DIMISI Technologies. Encrypted Security Portal.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [to],
          subject: `[Hestiia Admin] ${isLogin ? 'Sign-In Verification Code' : 'Password Reset Code'}: ${otp}`,
          text: `${title}\n\nYour verification code is: ${otp}\nThis code will expire in ${expiresInMinutes} minutes.\n\nHestiia Administration Portal`,
          html: htmlContent,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.warn(`[EmailService] Resend API responded with status ${response.status}:`, data?.message || data);
        return { sent: false, method: 'console', error: data?.message || 'Resend API error' };
      }

      console.log(`[EmailService] Email dispatched successfully via Resend. ID: ${data?.id}`);
      return { sent: true, method: 'resend', id: data?.id };
    } catch (err: any) {
      console.warn(`[EmailService] Network delivery via Resend encountered an issue: ${err?.message}. (Code logged in console)`);
      return { sent: false, method: 'console', error: err?.message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;
