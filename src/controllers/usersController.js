import * as usersRepository from '../repositories/usersRepository.js'
import { hashPassword } from '../utils/passwordHash.js'
import { HttpError } from '../utils/httpError.js'

export async function listUsers(req, res, next) {
  try {
    const users = await usersRepository.listUsers()
    return res.json({ data: users })
  } catch (error) {
    return next(error)
  }
}

export async function createUser(req, res, next) {
  try {
    const { firstName, lastName, username, email, password, role, profilePic } = req.validated.body

    await usersRepository.checkUniqueFields({ email, username, excludeId: null })
    const passwordHash = await hashPassword(password)
    const user = await usersRepository.createUser({
      firstName,
      lastName,
      username,
      email,
      passwordHash,
      role,
      profilePic,
    })

    return res.status(201).json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export async function updateUser(req, res, next) {
  try {
    const id = req.validated.params.id
    const { firstName, lastName, username, email, password, role, profilePic } = req.validated.body

    const existing = await usersRepository.getUserById(id)
    if (!existing) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'Member was not found')
    }

    if (existing.role === 'admin' && role !== 'admin') {
      const activeAdmins = await usersRepository.countActiveAdmins()
      if (activeAdmins <= 1) {
        throw new HttpError(409, 'LAST_ADMIN', 'At least one admin account is required')
      }
    }

    await usersRepository.checkUniqueFields({ email, username, excludeId: id })

    let user = await usersRepository.updateUser(id, {
      firstName,
      lastName,
      username,
      email,
      role,
      profilePic,
    })

    if (password) {
      const passwordHash = await hashPassword(password)
      user = await usersRepository.updateUserPassword(id, passwordHash)
    }

    return res.json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export async function deleteUser(req, res, next) {
  try {
    const id = req.validated.params.id

    if (req.user.id === id) {
      throw new HttpError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account')
    }

    const existing = await usersRepository.getUserById(id)
    if (!existing) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'Member was not found')
    }

    if (existing.role === 'admin') {
      const activeAdmins = await usersRepository.countActiveAdmins()
      if (activeAdmins <= 1) {
        throw new HttpError(409, 'LAST_ADMIN', 'At least one admin account is required')
      }
    }

    const deactivated = await usersRepository.deactivateUser(id)
    if (!deactivated) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'Member was not found')
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
