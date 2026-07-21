import cors from 'cors'
import express from 'express'
import categoriesRouter from './routes/categoriesRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import postsRouter from './routes/postsRoutes.js'
import uploadRouter from './routes/uploadRoutes.js'
import { hasSupabaseConfig, supabase } from './supabaseClient.js'

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'server',
    endpoints: ['/health', '/health/db', '/api/posts', '/api/uploads', '/api/categories'],
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'server' })
})

app.get('/health/db', async (_req, res, next) => {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        ok: false,
        database: 'missing_config',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env',
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
app.use('/api/uploads', uploadRouter)
app.use('/api/categories', categoriesRouter)
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

export default app
