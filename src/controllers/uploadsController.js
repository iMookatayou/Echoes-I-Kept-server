import { randomUUID } from 'node:crypto'
import { supabase } from '../supabaseClient.js'
import { HttpError } from '../utils/httpError.js'

const BUCKET = 'post-images'
const EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function uploadImage(req, res, next) {
  try {
    if (!supabase) {
      throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Supabase is not configured for the backend')
    }

    if (!req.file) {
      throw new HttpError(400, 'FILE_REQUIRED', 'Attach an image file under the "image" field')
    }

    const extension = EXTENSION_BY_MIME[req.file.mimetype]
    const objectPath = `${randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (uploadError) {
      throw new HttpError(500, 'UPLOAD_FAILED', uploadError.message)
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)

    return res.status(201).json({ data: { url: data.publicUrl } })
  } catch (error) {
    return next(error)
  }
}
