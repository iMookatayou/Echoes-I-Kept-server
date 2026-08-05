import { Resend } from 'resend'
import { HttpError } from './httpError.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL
const OTP_DEBUG_LOG = process.env.OTP_DEBUG_LOG === 'true'

export async function sendOtpEmail({ to, code, purpose }) {
  // Lets local/dev testing read a real code without a deliverable inbox —
  // must stay opt-in and off by default, never enabled in production.
  if (OTP_DEBUG_LOG) {
    console.log(`[otp-debug] ${purpose} code for ${to}: ${code}`)
  }

  if (!resend || !FROM_EMAIL) {
    throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email sending is not configured')
  }

  const subject = purpose === 'password_reset'
    ? 'Reset your Echoes I Kept password'
    : 'Verify your Echoes I Kept email'

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: `Your code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  })

  if (error) throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Failed to send email')
}
