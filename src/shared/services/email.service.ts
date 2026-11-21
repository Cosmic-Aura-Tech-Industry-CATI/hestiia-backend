import nodemailer, { type Transporter } from 'nodemailer';

interface SendOtpOptions {
  to: string;
  recipientName?: string;
  otp: string;
  purpose: 'LOGIN_2FA' | 'PASSWORD_RESET';
  expiresInMinutes?: number;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS;

    if (user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
        this.isConfigured = true;
        console.log(`[EmailService] Configured SMTP transporter for user: ${user}`);
      } catch (err: any) {
        console.warn(`[EmailService] Failed to initialize SMTP transporter: ${err?.message}`);
        this.transporter = null;
        this.isConfigured = false;
      }
    } else {
      console.log('[EmailService] SMTP credentials not fully configured. Using secure console dispatch mode.');
    }
  }

  async sendOtpEmail(options: SendOtpOptions): Promise<{ sent: boolean; method: 'smtp' | 'console'; error?: string }> {
    const { to, recipientName = 'Hestiia Administrator', otp, purpose, expiresInMinutes = 5 } = options;

    const isLogin = purpose === 'LOGIN_2FA';
    const title = isLogin ? 'Hestiia Admin — 2-Step Sign In Verification Code' : 'Hestiia Admin — Security Password Reset Code';
    const subtitle = isLogin
      ? 'A sign-in request was initiated for your Hestiia Administration Portal account.'
      : 'A security password reset was requested for your Hestiia Administration Portal account.';

    // Console notification (always logs for audit and local convenience)
    console.log('\n' + '='.repeat(70));
    console.log(`⭐ [HESTIIA AUTH] 2-STEP VERIFICATION OTP DISPATCHED`);
    console.log(`Recipient:   ${to} (${recipientName})`);
    console.log(`Purpose:     ${purpose} (${isLogin ? 'Login 2FA' : 'Password Reset'})`);
    console.log(`OTP Code:    >>> [ ${otp} ] <<<`);
    console.log(`Expiry:      ${expiresInMinutes} minutes`);
    console.log('='.repeat(70) + '\n');

    if (!this.isConfigured || !this.transporter) {
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
      const fromAddress = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'no-reply@hestiia.com';
      await this.transporter.sendMail({
        from: `"Hestiia Security Portal" <${fromAddress}>`,
        to,
        subject: `[Hestiia Admin] ${isLogin ? 'Sign-In Verification Code' : 'Password Reset Code'}: ${otp}`,
        text: `${title}\n\nYour verification code is: ${otp}\nThis code will expire in ${expiresInMinutes} minutes.\n\nHestiia Administration Portal`,
        html: htmlContent,
      });
      return { sent: true, method: 'smtp' };
    } catch (err: any) {
      console.error(`[EmailService] SMTP delivery failed: ${err?.message}. (Code logged in console)`);
      return { sent: false, method: 'console', error: err?.message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;
