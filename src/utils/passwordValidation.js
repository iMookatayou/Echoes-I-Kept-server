export const PASSWORD_REQUIREMENT_MESSAGE =
  'Use 8+ characters with a letter and a symbol.'

export function getPasswordStrengthError(password) {
  if (
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return PASSWORD_REQUIREMENT_MESSAGE
  }

  return ''
}
