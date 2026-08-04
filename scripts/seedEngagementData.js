// Adds realistic likes and comments to the 6 seed posts (ids 1-6), authored
// by real accounts created through the actual signup/comment/like endpoints —
// not raw DB inserts — so the data is indistinguishable from something a real
// member did: real password hashes, real token_version, real notifications
// fired at the post authors, real denormalized author_name/author_avatar
// snapshots on each comment.
//
// Safe to re-run: signup falls back to login for a user that already exists,
// and a duplicate like just gets swallowed (the API 409s on ALREADY_LIKED,
// which is exactly the state we want anyway).
//
// This is throwaway demo data for how the site looks with activity on it —
// all these accounts share the @seed.local email suffix specifically so
// they're easy to find and delete later:
//   delete from users where email like '%@seed.local';
// (cascades through their comments/likes/notifications).
const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:4000'
const SEED_PASSWORD = 'Demo2026!'

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const body = response.status === 204 ? null : await response.json()
  return { response, body }
}

const seedUsers = [
  { firstName: 'Nira', lastName: 'Suksan', username: 'nira_suksan' },
  { firstName: 'Jordan', lastName: 'Cole', username: 'jordan_cole' },
  { firstName: 'Aiko', lastName: 'Tanaka', username: 'aiko_tanaka' },
  { firstName: 'Marcus', lastName: 'Webb', username: 'marcus_webb' },
  { firstName: 'Priya', lastName: 'Anand', username: 'priya_anand' },
  { firstName: 'Leo', lastName: 'Fischer', username: 'leo_fischer' },
  { firstName: 'Sofia', lastName: 'Marin', username: 'sofia_marin' },
  { firstName: 'Dara', lastName: 'Chan', username: 'dara_chan' },
]

async function signupOrLogin(user) {
  const email = `${user.username}@seed.local`

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email,
      password: SEED_PASSWORD,
    }),
  })

  if (signup.response.ok) {
    return { ...user, id: signup.body.data.id, token: signup.body.accessToken }
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  })

  if (!login.response.ok) {
    throw new Error(`Could not sign up or log in ${email}: ${JSON.stringify(login.body)}`)
  }

  return { ...user, id: login.body.data.id, token: login.body.accessToken }
}

// Picks `count` users deterministically from `pool` starting at `offset`, so
// re-running the script always assigns the same people to the same post
// instead of a fresh random mix each time (which would just mean more
// duplicate-like 409s and no new signal).
function pick(pool, offset, count) {
  const result = []
  for (let i = 0; i < count; i += 1) {
    result.push(pool[(offset + i) % pool.length])
  }
  return result
}

const engagementByPostId = {
  1: {
    likeCount: 5,
    comments: [
      { offset: 1, text: "Birds of a Feather really does feel warmer than her other stuff. Been on repeat all month." },
      { offset: 4, text: "The contrast you described is exactly why this hits different on headphones." },
    ],
  },
  2: {
    likeCount: 4,
    comments: [
      { offset: 2, text: "This one still gets me every time. Great pick." },
      { offset: 6, text: "Didn't expect an analysis of the production here but you're right, it's way more layered than people give it credit for." },
    ],
  },
  3: {
    likeCount: 3,
    comments: [
      { offset: 0, text: "Reflections is so underrated honestly. Perfect late-night drive song." },
    ],
  },
  4: {
    likeCount: 6,
    comments: [
      { offset: 3, text: "Daylight closing out that album was such a good choice. Total mood shift." },
      { offset: 7, text: "This is such a thoughtful take, thank you for writing it." },
    ],
  },
  5: {
    likeCount: 4,
    comments: [
      { offset: 5, text: "The One That Got Away hits different once you've actually lived it." },
    ],
  },
  6: {
    likeCount: 5,
    comments: [
      { offset: 1, text: "That Gesaffelstein collab is so underrated, glad you covered it." },
      { offset: 5, text: "The atmosphere on this track is unmatched. Great write-up." },
    ],
  },
}

async function seedPost(postId, plan, users) {
  const likers = pick(users, postId, plan.likeCount)
  for (const user of likers) {
    const result = await request(`/api/posts/${postId}/likes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user.token}` },
    })
    if (!result.response.ok && result.body?.error?.code !== 'ALREADY_LIKED') {
      console.warn(`  like failed (post ${postId}, ${user.username}):`, result.body?.error)
    }
  }
  console.log(`  post ${postId}: ${likers.length} likes from ${likers.map((u) => u.username).join(', ')}`)

  for (const comment of plan.comments) {
    const author = users[comment.offset % users.length]
    const result = await request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${author.token}` },
      body: JSON.stringify({ commentText: comment.text }),
    })
    if (!result.response.ok) {
      console.warn(`  comment failed (post ${postId}, ${author.username}):`, result.body?.error)
    } else {
      console.log(`  post ${postId}: comment from ${author.username}`)
    }
  }
}

console.log(`Seeding engagement data against ${baseUrl}\n`)

console.log('Creating/logging in seed users...')
const users = []
for (const user of seedUsers) {
  users.push(await signupOrLogin(user))
}
console.log(`  ${users.length} users ready\n`)

console.log('Seeding likes and comments...')
for (const [postId, plan] of Object.entries(engagementByPostId)) {
  await seedPost(Number(postId), plan, users)
}

// Kept out of `seedUsers` on purpose — that array's index order is what the
// `pick()`/`comment.offset` assignments above are keyed to, so adding
// accounts here can't shift any of that. "Techin B." matches the byline
// already used in the site's own copy (the hero's "A note from Techin B."),
// so the admin account reads as the same person the site already claims
// wrote it, not an unrelated test label.
console.log('\nCreating a matching admin + member login...')
const adminDesignate = await signupOrLogin({
  firstName: 'Techin',
  lastName: 'B.',
  username: 'techin_b',
})
const memberDesignate = await signupOrLogin({
  firstName: 'Maya',
  lastName: 'Lindqvist',
  username: 'maya_lindqvist',
})

console.log('\nDone. Logins (password for every seeded account is Demo2026!):')
console.log(`  admin  : ${adminDesignate.username}@seed.local`)
console.log(`  member : ${memberDesignate.username}@seed.local`)
for (const user of users) {
  console.log(`  member : ${user.username}@seed.local`)
}

console.log('\nPromote the admin account (not exposed over the API on purpose):')
console.log(
  `  update public.users set role = 'admin' where id = '${adminDesignate.id}';`,
)

console.log('\nTo remove all of this later:')
console.log("  delete from users where email like '%@seed.local';")
