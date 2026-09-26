import { createServer } from 'node:http'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createStore } from './store.mjs'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOwnerEmail = 'lucasthyagootk@gmail.com'
const defaultOwnerName = 'Luthyb'
const sessionLifetimeSeconds = 60 * 60 * 12
const passwordBytes = 64
const deriveKey = promisify(scryptCallback)

function safeEqual(value, expectedValue) {
  const actual = Buffer.from(String(value ?? ''))
  const expected = Buffer.from(String(expectedValue ?? ''))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function publicAccount({ password, passwordHash, passwordSalt, ...account }) {
  return account
}

function hasAdminAccess(account) {
  return account.isOwner || account.role === 'Administrador'
}

async function hashPassword(password, salt = randomBytes(16)) {
  return {
    passwordSalt: salt.toString('hex'),
    passwordHash: (await deriveKey(password, salt, passwordBytes)).toString('hex'),
  }
}

async function matchesPassword(password, account) {
  const salt = Buffer.from(account.passwordSalt, 'hex')
  const expected = Buffer.from(account.passwordHash, 'hex')
  const actual = await deriveKey(password, salt, passwordBytes)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  let body = ''
  let size = 0
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk)
    if (size > 5 * 1024 * 1024) {
      const error = new Error('A solicitação excede o limite permitido.')
      error.status = 413
      throw error
    }
    body += chunk
  }
  return body ? JSON.parse(body) : {}
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(';') ?? []
  const cookie = cookies.find((part) => part.trim().startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : ''
}

function sessionCookie(token, maxAge = sessionLifetimeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `crm_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function validateWorkspace(workspace) {
  const collections = ['prospects', 'leads', 'followUps', 'companyChanges']
  if (!workspace || collections.some((collection) => !Array.isArray(workspace[collection]))) return false
  const validRecords = collections.every((collection) => workspace[collection].length <= 5000 && workspace[collection].every((record) => record && typeof record === 'object' && !Array.isArray(record) && ((typeof record.id === 'number' && Number.isFinite(record.id)) || (typeof record.id === 'string' && record.id.length > 0)) && JSON.stringify(record).length <= 100_000))
  return validRecords && typeof workspace.workspaceName === 'string' && workspace.workspaceName.trim().length > 0 && workspace.workspaceName.length <= 100
}

export function createApiServer(options = {}) {
  const defaultDataDirectory = path.join(rootDirectory, 'data')
  const dataDirectory = options.dataDirectory ?? (process.env.CRM_DATA_DIR ? path.resolve(process.env.CRM_DATA_DIR) : defaultDataDirectory)
  const shouldImportLegacyAccounts = !options.dataDirectory && Boolean(process.env.CRM_DATA_DIR) && path.resolve(dataDirectory) !== path.resolve(defaultDataDirectory)
  const ownerEmail = process.env.CRM_OWNER_EMAIL || defaultOwnerEmail
  const ownerName = process.env.CRM_OWNER_NAME || defaultOwnerName
  const accountsFile = path.join(dataDirectory, 'accounts.json')
  const legacyAccountsFile = path.join(defaultDataDirectory, 'accounts.json')
  const allowedOrigins = new Set((process.env.CRM_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim()).filter(Boolean))
  if (process.env.NODE_ENV === 'production' && (!process.env.CRM_ALLOWED_ORIGINS || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.CRM_OWNER_EMAIL || '') || !/^[a-f0-9]{64,}$/i.test(process.env.CRM_BOOTSTRAP_TOKEN || ''))) {
    throw new Error('Configure CRM_OWNER_EMAIL, CRM_ALLOWED_ORIGINS e um CRM_BOOTSTRAP_TOKEN gerado com openssl rand -hex 32 antes de iniciar em produção.')
  }
  if (process.env.NODE_ENV === 'production' && [...allowedOrigins].some((origin) => new URL(origin).protocol !== 'https:')) {
    throw new Error('Em produção, CRM_ALLOWED_ORIGINS deve conter apenas origens HTTPS.')
  }
  const store = createStore(dataDirectory)
  const attempts = new Map()
  const dummySalt = randomBytes(16).toString('hex')
  const dummyAccount = { passwordSalt: dummySalt, passwordHash: randomBytes(passwordBytes).toString('hex') }

  const readAccounts = async () => {
    try {
      return JSON.parse(await readFile(accountsFile, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') {
        if (shouldImportLegacyAccounts) {
          try {
            const legacyAccounts = JSON.parse(await readFile(legacyAccountsFile, 'utf8'))
            await writeAccounts(legacyAccounts)
            return legacyAccounts
          } catch (legacyError) {
            if (legacyError.code !== 'ENOENT') throw legacyError
          }
        }
        return []
      }
      throw error
    }
  }

  const writeAccounts = async (accounts) => {
    await mkdir(dataDirectory, { recursive: true })
    const temporaryFile = `${accountsFile}.${randomBytes(6).toString('hex')}.tmp`
    await writeFile(temporaryFile, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 })
    await rename(temporaryFile, accountsFile)
  }

  const getSessionAccount = async (request, accounts) => {
    const token = cookieValue(request, 'crm_session')
    if (!token) return null
    const session = store.getSession(tokenHash(token))
    if (!session || session.expiresAt <= Date.now()) {
      if (session) store.deleteSession(tokenHash(token))
      return null
    }
    return accounts.find((account) => account.id === session.userId) ?? null
  }

  const createSession = (account) => {
    const token = randomBytes(32).toString('hex')
    store.createSession(tokenHash(token), account.id, Date.now() + sessionLifetimeSeconds * 1000)
    return token
  }

  const checkRateLimit = (request, key) => {
    const address = request.socket.remoteAddress || 'unknown'
    const forwarded = request.headers['x-forwarded-for']
    const clientAddress = address === '127.0.0.1' || address === '::1'
      ? String(forwarded || address).split(',')[0].trim()
      : address
    const rateKey = `${clientAddress}:${key}`
    const now = Date.now()
    const current = attempts.get(rateKey)
    if (!current || current.resetAt <= now) {
      if (attempts.size > 10000) {
        for (const [key, limit] of attempts) if (limit.resetAt <= now) attempts.delete(key)
      }
      attempts.set(rateKey, { count: 1, resetAt: now + 15 * 60 * 1000 })
      return true
    }
    current.count += 1
    return current.count <= 10
  }

  const handler = async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { ok: true })
        return
      }

      const origin = request.headers.origin
      if (origin && !allowedOrigins.has(origin)) {
        sendJson(response, 403, { error: 'Origem não permitida.' })
        return
      }
      if (process.env.NODE_ENV === 'production' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !origin) {
        sendJson(response, 403, { error: 'Origem da solicitação não informada.' })
        return
      }

      let accounts = await readAccounts()
      const currentAccount = await getSessionAccount(request, accounts)

      if (url.pathname === '/api/auth/session' && request.method === 'GET') {
        sendJson(response, 200, {
          user: currentAccount ? publicAccount(currentAccount) : null,
          users: currentAccount ? (hasAdminAccess(currentAccount) ? accounts : [currentAccount]).map(publicAccount) : [],
          hasUsers: accounts.length > 0,
        })
        return
      }

      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        if (!checkRateLimit(request, 'register')) {
          sendJson(response, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' })
          return
        }
        if (accounts.length > 0) {
          sendJson(response, 409, { error: 'A conta do proprietário já foi configurada.' })
          return
        }
        const body = await readJson(request)
        if (process.env.NODE_ENV === 'production' && !safeEqual(body.bootstrapToken, process.env.CRM_BOOTSTRAP_TOKEN)) {
          sendJson(response, 403, { error: 'Token de configuração inválido.' })
          return
        }
        if (String(body.email ?? '').trim().toLowerCase() !== ownerEmail) {
          sendJson(response, 400, { error: 'Use o e-mail definido para a conta do proprietário.' })
          return
        }
        const configuredName = String(body.name ?? ownerName).trim()
        if (!configuredName || configuredName.length > 100) {
          sendJson(response, 400, { error: 'Informe um nome de até 100 caracteres para a conta do proprietário.' })
          return
        }
        if (typeof body.password !== 'string' || body.password.length < 12) {
          sendJson(response, 400, { error: 'A senha deve ter pelo menos 12 caracteres.' })
          return
        }
        const account = {
          id: Date.now(),
          name: configuredName,
          email: ownerEmail,
          role: 'Administrador',
          status: 'Disponível',
          timezone: 'Brasília (GMT-3)',
          photo: '',
          isOwner: true,
          ...await hashPassword(body.password),
        }
        accounts = [account]
        await writeAccounts(accounts)
        const token = createSession(account)
        sendJson(response, 201, { user: publicAccount(account), users: [publicAccount(account)] }, { 'Set-Cookie': sessionCookie(token) })
        return
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        if (!checkRateLimit(request, 'login')) {
          sendJson(response, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' })
          return
        }
        const body = await readJson(request)
        const email = String(body.email ?? '').trim().toLowerCase()
        const account = accounts.find((item) => item.email.toLowerCase() === email)
        if (typeof body.password !== 'string' || body.password.length > 1024) {
          sendJson(response, 401, { error: 'E-mail ou senha inválidos.' })
          return
        }
        const passwordMatches = await matchesPassword(body.password, account || dummyAccount)
        if (!account || !passwordMatches) {
          sendJson(response, 401, { error: 'E-mail ou senha inválidos.' })
          return
        }
        const token = createSession(account)
        sendJson(response, 200, { user: publicAccount(account), users: (hasAdminAccess(account) ? accounts : [account]).map(publicAccount) }, { 'Set-Cookie': sessionCookie(token) })
        return
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const token = cookieValue(request, 'crm_session')
        if (token) store.deleteSession(tokenHash(token))
        sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) })
        return
      }

      if (!currentAccount) {
        sendJson(response, 401, { error: 'Faça login para continuar.' })
        return
      }

      if (url.pathname === '/api/data' && request.method === 'GET') {
        sendJson(response, 200, store.getWorkspace())
        return
      }

      if (url.pathname === '/api/data/import' && request.method === 'POST') {
        if (!hasAdminAccess(currentAccount)) {
          sendJson(response, 403, { error: 'Somente administradores podem importar os dados iniciais.' })
          return
        }
        const body = await readJson(request)
        if (!validateWorkspace(body) || Object.values(body).some((value) => Array.isArray(value) && value.length > 5000)) {
          sendJson(response, 400, { error: 'Os dados para importação são inválidos.' })
          return
        }
        if (!store.importWorkspace(body)) {
          sendJson(response, 409, { error: 'Os dados deste workspace já foram inicializados.' })
          return
        }
        sendJson(response, 201, store.getWorkspace())
        return
      }

      if (url.pathname === '/api/data/restore' && request.method === 'POST') {
        if (!hasAdminAccess(currentAccount)) {
          sendJson(response, 403, { error: 'Somente administradores podem restaurar um backup.' })
          return
        }
        const body = await readJson(request)
        const workspace = body.workspace ?? body
        if (!validateWorkspace(workspace) || Object.values(workspace).some((value) => Array.isArray(value) && value.length > 5000)) {
          sendJson(response, 400, { error: 'O arquivo de backup é inválido.' })
          return
        }
        store.replaceWorkspace(workspace)
        sendJson(response, 200, store.getWorkspace())
        return
      }

      if (url.pathname === '/api/data/workspace' && request.method === 'PATCH') {
        if (!hasAdminAccess(currentAccount)) {
          sendJson(response, 403, { error: 'Somente administradores podem alterar o workspace.' })
          return
        }
        const body = await readJson(request)
        const name = String(body.workspaceName ?? '').trim()
        if (!name || name.length > 100) {
          sendJson(response, 400, { error: 'O nome do workspace deve ter entre 1 e 100 caracteres.' })
          return
        }
        store.setWorkspaceName(name)
        sendJson(response, 200, store.getWorkspace())
        return
      }

      const collectionMatch = url.pathname.match(/^\/api\/data\/(prospects|leads|followUps|companyChanges)$/)
      if (collectionMatch && request.method === 'PATCH') {
        const workspace = store.getWorkspace()
        if (!workspace.initialized) {
          sendJson(response, 409, { error: 'O administrador precisa inicializar os dados do workspace primeiro.' })
          return
        }
        const body = await readJson(request)
        if (!Array.isArray(body.upsert) || !Array.isArray(body.delete) || body.upsert.length > 1000 || body.delete.length > 1000 || body.upsert.some((item) => !item || typeof item !== 'object' || Array.isArray(item) || !((typeof item.id === 'number' && Number.isFinite(item.id)) || (typeof item.id === 'string' && item.id.length > 0)) || JSON.stringify(item).length > 100_000) || body.delete.some((id) => !((typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.length > 0)))) {
          sendJson(response, 400, { error: 'A alteração enviada é inválida.' })
          return
        }
        store.updateCollection(collectionMatch[1], body)
        sendJson(response, 200, { ok: true })
        return
      }

      if (url.pathname === '/api/users' && request.method === 'GET') {
        if (!hasAdminAccess(currentAccount)) {
          sendJson(response, 403, { error: 'Somente administradores podem consultar os usuários.' })
          return
        }
        sendJson(response, 200, { users: accounts.map(publicAccount) })
        return
      }

      if (url.pathname === '/api/users' && request.method === 'POST') {
        if (!hasAdminAccess(currentAccount)) {
          sendJson(response, 403, { error: 'Somente administradores podem cadastrar usuários.' })
          return
        }
        const body = await readJson(request)
        const email = String(body.email ?? '').trim().toLowerCase()
        const name = String(body.name ?? '').trim()
        if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || accounts.some((account) => account.email.toLowerCase() === email)) {
          sendJson(response, 400, { error: 'Informe um nome e e-mail únicos.' })
          return
        }
        if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024) {
          sendJson(response, 400, { error: 'A senha deve ter pelo menos 12 caracteres.' })
          return
        }
        const account = {
          id: Date.now(),
          name,
          email,
          role: ['Colaborador', 'Administrador', 'Gestor'].includes(body.role) ? body.role : 'Colaborador',
          status: 'Disponível',
          timezone: 'Brasília (GMT-3)',
          photo: String(body.photo ?? ''),
          isOwner: false,
          ...await hashPassword(body.password),
        }
        accounts = [...accounts, account]
        await writeAccounts(accounts)
        sendJson(response, 201, { users: accounts.map(publicAccount) })
        return
      }

      if (url.pathname === '/api/users/me' && request.method === 'PATCH') {
        const body = await readJson(request)
        const email = String(body.email ?? currentAccount.email).trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          sendJson(response, 400, { error: 'Informe um e-mail válido.' })
          return
        }
        if (currentAccount.isOwner && email !== ownerEmail) {
          sendJson(response, 400, { error: 'O e-mail principal do proprietário não pode ser alterado.' })
          return
        }
        if (accounts.some((account) => account.id !== currentAccount.id && account.email.toLowerCase() === email)) {
          sendJson(response, 409, { error: 'Já existe uma conta com este e-mail.' })
          return
        }
        const updated = {
          ...currentAccount,
          name: String(body.name ?? currentAccount.name).trim() || currentAccount.name,
          email,
          role: hasAdminAccess(currentAccount) && ['Colaborador', 'Administrador', 'Gestor'].includes(body.role) ? body.role : currentAccount.role,
          status: hasAdminAccess(currentAccount) ? String(body.status ?? currentAccount.status) : currentAccount.status,
          timezone: hasAdminAccess(currentAccount) ? String(body.timezone ?? currentAccount.timezone) : currentAccount.timezone,
          photo: hasAdminAccess(currentAccount) ? String(body.photo ?? currentAccount.photo) : currentAccount.photo,
        }
        if (body.password) {
          if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024) {
            sendJson(response, 400, { error: 'A senha deve ter pelo menos 12 caracteres.' })
            return
          }
          Object.assign(updated, await hashPassword(body.password))
        }
        accounts = accounts.map((account) => account.id === updated.id ? updated : account)
        await writeAccounts(accounts)
        let responseHeaders = {}
        if (body.password) {
          store.deleteUserSessions(updated.id)
          const token = createSession(updated)
          responseHeaders = { 'Set-Cookie': sessionCookie(token) }
        }
        sendJson(response, 200, { user: publicAccount(updated), users: (hasAdminAccess(updated) ? accounts : [updated]).map(publicAccount) }, responseHeaders)
        return
      }

      const userIdMatch = url.pathname.match(/^\/api\/users\/(\d+)$/)
      if (userIdMatch && request.method === 'DELETE') {
        const userId = Number(userIdMatch[1])
        if (!hasAdminAccess(currentAccount) || userId === currentAccount.id || accounts.some((account) => account.id === userId && account.isOwner)) {
          sendJson(response, 403, { error: 'Ação não permitida.' })
          return
        }
        accounts = accounts.filter((account) => account.id !== userId)
        await writeAccounts(accounts)
        store.deleteUserSessions(userId)
        sendJson(response, 200, { users: accounts.map(publicAccount) })
        return
      }

      sendJson(response, 404, { error: 'Rota não encontrada.' })
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : error.status || 500
      if (status === 500) console.error('CRM API failure:', error)
      sendJson(response, status, { error: status === 500 ? 'Erro interno do servidor.' : error.message })
    }
  }

  const server = createServer((request, response) => void handler(request, response))
  server.on('close', () => store.close())
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apiServer = createApiServer()
  apiServer.listen(5174, '127.0.0.1', () => console.log('Accounts API listening on http://127.0.0.1:5174'))
}