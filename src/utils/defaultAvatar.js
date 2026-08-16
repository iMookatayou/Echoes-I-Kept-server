export function defaultAvatarUrl(firstName, lastName) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || 'User'
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4A5568&color=fff`
}
