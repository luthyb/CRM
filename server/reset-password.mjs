import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { chmod, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { createStore } from './store.mjs'

const deriveKey = promisify(scryptCallback)

export async function resetAccountPassword({ dataDirectory, email, password }) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('A nova senha deve ter entre 12 e 1024 caracteres.')
  }
  const accountsPath = path.join(dataDirectory, 'accounts.json')
  const accounts = JSON.parse(await readFile(accountsPath, 'utf8'))
  const account = accounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase())
  if (!account) throw new Error('Não existe uma conta com esse e-mail.')

  const salt = randomBytes(16)
  account.passwordSalt = salt.toString('hex')
  account.passwordHash = (await deriveKey(password, salt, 64)).toString('hex')
  const temporaryPath = `${accountsPath}.${randomBytes(6).toString('hex')}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 })
  await chmod(temporaryPath, 0o600)
  await rename(temporaryPath, accountsPath)

  const store = createStore(dataDirectory)
  try {
    store.deleteUserSessions(account.id)
  } finally {
    store.close()
  }
}
