import cors from 'cors'
import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import postsRouter from './routes/postsRoutes.js'
import { hasSupabaseConfig, supabase } from './supabaseClient.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'backend',
    endpoints: ['/health', '/health/db', '/api/posts'],
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend' })
})

app.get('/health/db', async (_req, res, next) => {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        ok: false,
        database: 'missing_config',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env',
      })
    }

    const { error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })
    if (error) throw error

    return res.json({ ok: true, database: 'connected' })
  } catch (error) {
    return next(error)
  }
})

app.use('/api/posts', postsRouter)
app.use(notFoundHandler)
app.use(errorHandler)

export default app
