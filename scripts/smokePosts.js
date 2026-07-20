const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:4000'

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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const createPayload = {
  category: 'Pop',
  artist: 'API Smoke Artist',
  bestPick: 'API Smoke Song',
  spotifyUrl: null,
  image: '/music-covers/Charlie_Puth.webp',
  detailImage: '/music-covers/Charlie_Puth_Wallpaper.webp',
  detailImagePosition: 'center',
  title: 'API smoke test post',
  description: 'A temporary post created by the backend smoke test.',
  content: 'This post verifies create, update, and delete behavior.',
  status: 'draft',
  authorName: 'Techin B.',
  authorAvatar: '/avatars/anime.jpg',
  authorBio: ['Temporary API smoke test author snapshot.'],
}

let createdId

try {
  const list = await request('/api/posts?status=published&page=1&limit=6')
  assert(list.response.status === 200, 'GET /api/posts should return 200')
  assert(Array.isArray(list.body.data), 'GET /api/posts should return a data array')
  assert(list.body.data.length === 6, 'Seeded published post list should contain 6 posts')

  const page = await request('/api/posts?status=published&page=2&limit=2')
  assert(page.response.status === 200, 'Paginated GET should return 200')
  assert(page.body.data.length === 2, 'Page 2 with limit 2 should contain 2 posts')
  assert(page.body.pagination.total === 6, 'Pagination should report 6 seeded posts')

  const category = await request('/api/posts?category=alternative&limit=10')
  assert(category.response.status === 200, 'Category filter should return 200')
  assert(category.body.data.length === 2, 'Alternative category should contain 2 posts')

  const search = await request('/api/posts?search=Daylight&limit=10')
  assert(search.response.status === 200, 'Search filter should return 200')
  assert(search.body.data.length === 1, 'Daylight search should contain 1 post')

  const detail = await request('/api/posts/1')
  assert(detail.response.status === 200, 'GET /api/posts/1 should return 200')
  assert(detail.body.data.id === 1, 'GET /api/posts/1 should return post 1')

  const invalid = await request('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ title: '' }),
  })
  assert(invalid.response.status === 400, 'Invalid POST should return 400')

  const created = await request('/api/posts', {
    method: 'POST',
    body: JSON.stringify(createPayload),
  })
  assert(created.response.status === 201, 'POST /api/posts should return 201')
  createdId = created.body.data.id

  const drafts = await request('/api/posts?status=draft&limit=50')
  assert(drafts.response.status === 200, 'Draft filter should return 200 locally')
  assert(
    drafts.body.data.some((post) => post.id === createdId),
    'Draft filter should include the newly created draft',
  )

  const updated = await request(`/api/posts/${createdId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...createPayload,
      title: 'Updated API smoke test post',
      status: 'published',
    }),
  })
  assert(updated.response.status === 200, 'PUT /api/posts/:id should return 200')
  assert(updated.body.data.status === 'published', 'PUT should update post status')

  const deleted = await request(`/api/posts/${createdId}`, { method: 'DELETE' })
  assert(deleted.response.status === 204, 'DELETE /api/posts/:id should return 204')
  createdId = null

  const missing = await request(`/api/posts/${updated.body.data.id}`)
  assert(missing.response.status === 404, 'Deleted post should return 404')

  console.log('Post CRUD smoke test passed')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (createdId) {
    await request(`/api/posts/${createdId}`, { method: 'DELETE' }).catch(() => {})
  }
}
