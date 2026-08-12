import { Resend } from 'resend'
import { HttpError } from './httpError.js'
import { PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES } from './passwordResetToken.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL
const OTP_DEBUG_LOG = process.env.OTP_DEBUG_LOG === 'true'

// Same origin CORS already trusts (src/app.js) — reused rather than adding a
// second env var for what's already "the client's URL" in this codebase.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

function requireEmailConfigured() {
  if (!resend || !FROM_EMAIL) {
    throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email sending is not configured')
  }
}

// Signup verification only now — password reset moved to a link token (see
// sendPasswordResetEmail below). Deliberately just the bare path, no email
// or code in the query string: VerifyCodePage.jsx restores { email } from
// sessionStorage (see verifyCodeSession.js's own comment on why — a URL is
// exactly the leak path, browser history, Referer headers, that a plain
// page link would reopen). On the device that started the flow, the field
// prefills itself; on a different device the user just types their email
// once, and the code still has to come from this email either way.
const VERIFY_URL = `${CLIENT_ORIGIN}/verify-code`

export async function sendOtpEmail({ to, code }) {
  // Lets local/dev testing read a real code without a deliverable inbox —
  // must stay opt-in and off by default, never enabled in production.
  if (OTP_DEBUG_LOG) {
    console.log(`[otp-debug] signup_verify code for ${to}: ${code}`)
  }

  requireEmailConfigured()

  const subject = 'Verify your Echoes I Kept email'
  const intro =
    "Use this code to verify your email and finish creating your account. If you didn't request this, you can ignore this email."

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: [
      subject,
      '',
      intro,
      '',
      `Your code: ${code}`,
      '(expires in 10 minutes)',
      '',
      `Continue: ${VERIFY_URL}`,
    ].join('\n'),
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a; line-height: 1.5;">
        <h1 style="font-size: 18px; margin: 0 0 16px;">${subject}</h1>
        <p style="margin: 0 0 20px; color: #444;">${intro}</p>
        <p style="margin: 0 0 8px; font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center;">${code}</p>
        <p style="margin: 0 0 24px; font-size: 13px; color: #777; text-align: center;">Expires in 10 minutes</p>
        <p style="text-align: center; margin: 0 0 24px;">
          <a href="${VERIFY_URL}" style="display: inline-block; padding: 10px 24px; background: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Enter code
          </a>
        </p>
        <p style="font-size: 12px; color: #999; margin: 0;">
          Or go to ${VERIFY_URL} and enter the code above. Didn't request this? You can ignore this email.
        </p>
      </div>
    `,
  })

  if (error) throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Failed to send email')
}

// The raw token lives only in this URL — the server only ever stores its
// hash (see passwordResetTokensRepository) — so this link is the single
// credential that proves mailbox control. Clicking it just opens the "set a
// new password" form; the token isn't consumed until that form is actually
// submitted, so an email client or link scanner prefetching this URL can't
// burn the single use before the real recipient gets to it.
export async function sendPasswordResetEmail({ to, token }) {
  if (OTP_DEBUG_LOG) {
    console.log(`[otp-debug] password_reset token for ${to}: ${token}`)
  }

  requireEmailConfigured()

  const resetUrl = `${CLIENT_ORIGIN}/reset-password/${token}`
  const subject = 'Reset your Echoes I Kept password'
  const intro =
    "Click below to choose a new password. If you didn't request this, you can ignore this email — your password won't change."
  const expiry = `This link expires in ${PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES} minutes and works once.`

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: [subject, '', intro, '', expiry, '', `Reset your password: ${resetUrl}`].join('\n'),
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a; line-height: 1.5;">
        <h1 style="font-size: 18px; margin: 0 0 16px;">${subject}</h1>
        <p style="margin: 0 0 20px; color: #444;">${intro}</p>
        <p style="text-align: center; margin: 0 0 20px;">
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 24px; background: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Reset password
          </a>
        </p>
        <p style="margin: 0 0 24px; font-size: 13px; color: #777; text-align: center;">${expiry}</p>
        <p style="font-size: 12px; color: #999; margin: 0; word-break: break-all;">
          Or paste this link into your browser: ${resetUrl}
        </p>
      </div>
    `,
  })

  if (error) throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Failed to send email')
}
