import { Router } from 'express'
import multer from 'multer'
import { uploadImage } from '../controllers/uploadsController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { HttpError } from '../utils/httpError.js'

// No GIF — animated GIFs run far larger than a still jpg/png/webp at the
// same visual size, and post images don't need animation.
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new HttpError(400, 'UNSUPPORTED_FILE_TYPE', `Unsupported file type: ${file.mimetype}`))
      return
    }
    cb(null, true)
  },
})

const uploadRouter = Router()

uploadRouter.post('/', requireAuth, upload.single('image'), uploadImage)

export default uploadRouter
