import { Router } from 'express'
import multer from 'multer'
import { uploadImage } from '../controllers/uploadsController.js'
import { localMutationOnly } from '../middleware/localMutationOnly.js'
import { HttpError } from '../utils/httpError.js'

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

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

uploadRouter.post('/', localMutationOnly, upload.single('image'), uploadImage)

export default uploadRouter
