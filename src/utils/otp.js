import { randomInt, createHash, timingSafeEqual } from 'node:crypto'

const OTP_EXPIRES_IN_MINUTES = Number(process.env.OTP_EXPIRES_IN_MINUTES || 10)

export function generateOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashOtpCode(code) {
  return createHash('sha256').update(code).digest('hex')
}

export function otpExpiresAt() {
  return new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000)
}

export function verifyOtpCode(inputCode, storedHash) {
  const inputBuffer = Buffer.from(hashOtpCode(inputCode), 'hex')
  const storedBuffer = Buffer.from(storedHash, 'hex')
  if (inputBuffer.length !== storedBuffer.length) return false
  return timingSafeEqual(inputBuffer, storedBuffer)
}
