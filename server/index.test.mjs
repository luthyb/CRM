import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApiServer } from './index.mjs'
import { resetAccountPassword } from './reset-password.mjs'
import { createStore } from './store.mjs'

const deriveKey = promisify(scryptCallback)

test('owner account uses a salted password hash and authenticates through a session', async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'crm-accounts-'))
  const server = createApiServer({ dataDirectory })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const password = 'Testing-Only-Password-448!'

  try {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucasthyagootk@gmail.com', password }),
    })
    assert.equal(registerResponse.status, 201)
    const cookie = registerResponse.headers.getSetCookie()[0].split(';')[0]
    const accountFile = await readFile(path.join(dataDirectory, 'accounts.json'), 'utf8')
    const storedAccounts = JSON.parse(accountFile)
    assert.equal(storedAccounts[0].name, 'Luthyb')
    assert.equal(storedAccounts[0].email, 'lucasthyagootk@gmail.com')
    assert.equal(typeof storedAccounts[0].passwordSalt, 'string')
    assert.equal(typeof storedAccounts[0].passwordHash, 'string')
    assert.equal(accountFile.includes(password), false)

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucasthyagootk@gmail.com', password: 'incorrect-password' }),
    })
    assert.equal(loginResponse.status, 401)

    const validLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucasthyagootk@gmail.com', password }),
    })
    assert.equal(validLoginResponse.status, 200)

    const addUserResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Equipe Teste', email: 'equipe@example.com', password: 'Another-Test-Password-923!', role: 'Colaborador' }),
    })
    assert.equal(addUserResponse.status, 201)
    const addedUsers = await addUserResponse.json()
    assert.equal(addedUsers.users.length, 2)
    assert.equal('passwordHash' in addedUsers.users[1], false)
    assert.equal('passwordSalt' in addedUsers.users[1], false)
    assert.equal((await readFile(path.join(dataDirectory, 'accounts.json'), 'utf8')).includes('Another-Test-Password-923!'), false)

    const collaboratorLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'equipe@example.com', password: 'Another-Test-Password-923!' }),
    })
    assert.equal(collaboratorLoginResponse.status, 200)
    const collaboratorLogin = await collaboratorLoginResponse.json()
    assert.equal(collaboratorLogin.users.length, 1)
    const collaboratorCookie = collaboratorLoginResponse.headers.getSetCookie()[0].split(';')[0]

    const collaboratorAddUserResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: collaboratorCookie },
      body: JSON.stringify({ name: 'Outro usuário', email: 'outro@example.com', password: 'Third-Test-Password-331!' }),
    })
    assert.equal(collaboratorAddUserResponse.status, 403)

    const collaboratorUsersResponse = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: collaboratorCookie } })
    assert.equal(collaboratorUsersResponse.status, 403)
    const collaboratorWorkspaceResponse = await fetch(`${baseUrl}/api/data/workspace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: collaboratorCookie },
      body: JSON.stringify({ workspaceName: 'Alterado por colaborador' }),
    })
    assert.equal(collaboratorWorkspaceResponse.status, 403)
    const collaboratorRestoreResponse = await fetch(`${baseUrl}/api/data/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: collaboratorCookie },
      body: JSON.stringify({ prospects: [], leads: [], followUps: [], companyChanges: [], workspaceName: 'Substituído' }),
    })
    assert.equal(collaboratorRestoreResponse.status, 403)

    const importResponse = await fetch(`${baseUrl}/api/data/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        prospects: [{ id: 1, company: 'Empresa Persistida' }],
        leads: [{ id: 2, company: 'Lead Persistido' }],
        followUps: [],
        companyChanges: [{ id: 10.5, companyId: 1, company: 'Empresa Persistida', field: 'Nicho', previousValue: 'A', newValue: 'B', changedAt: '2026-09-26T00:00:00.000Z' }],
        workspaceName: 'Agência Aurora',
      }),
    })
    assert.equal(importResponse.status, 201)
    const companyNotesResponse = await fetch(`${baseUrl}/api/data/prospects`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ upsert: [{ id: 1, company: 'Empresa Persistida', notes: 'Prefere reuniões pela manhã.' }], delete: [] }),
    })
    assert.equal(companyNotesResponse.status, 200)
    const persistResponse = await fetch(`${baseUrl}/api/data/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: collaboratorCookie },
      body: JSON.stringify({ upsert: [{ id: 3, company: 'Lead novo' }], delete: [] }),
    })
    assert.equal(persistResponse.status, 200)
    const storedWorkspace = await (await fetch(`${baseUrl}/api/data`, { headers: { Cookie: cookie } })).json()
    assert.equal(storedWorkspace.prospects[0].company, 'Empresa Persistida')
    assert.equal(storedWorkspace.prospects[0].notes, 'Prefere reuniões pela manhã.')
    assert.deepEqual(storedWorkspace.leads.map((lead) => lead.id), [2, 3])
    assert.equal(storedWorkspace.companyChanges[0].id, 10.5)

    const collaboratorUpdateResponse = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: collaboratorCookie },
      body: JSON.stringify({ name: 'Equipe Atualizada', email: 'equipe-nova@example.com', role: 'Administrador', status: 'Ocupado', timezone: 'Amazonas (GMT-4)', photo: 'profile-image' }),
    })
    assert.equal(collaboratorUpdateResponse.status, 200)
    const collaboratorUpdate = await collaboratorUpdateResponse.json()
    assert.equal(collaboratorUpdate.user.name, 'Equipe Atualizada')
    assert.equal(collaboratorUpdate.user.email, 'equipe-nova@example.com')
    assert.equal(collaboratorUpdate.user.role, 'Colaborador')
    assert.equal(collaboratorUpdate.user.status, 'Disponível')
    assert.equal(collaboratorUpdate.user.timezone, 'Brasília (GMT-3)')
    assert.equal(collaboratorUpdate.user.photo, '')

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookie } })
    const session = await sessionResponse.json()
    assert.equal(session.user.name, 'Luthyb')
    assert.equal('passwordHash' in session.user, false)
    assert.equal('passwordSalt' in session.user, false)

    const rejectedOriginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
      body: JSON.stringify({ email: 'lucasthyagootk@gmail.com', password }),
    })
    assert.equal(rejectedOriginResponse.status, 403)

    const passwordChangeResponse = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ password: 'Updated-Owner-Password-718!' }),
    })
    assert.equal(passwordChangeResponse.status, 200)
    const renewedCookie = passwordChangeResponse.headers.getSetCookie()[0].split(';')[0]
    const oldSessionResponse = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookie } })
    assert.equal((await oldSessionResponse.json()).user, null)

    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    const restartedServer = createApiServer({ dataDirectory })
    await new Promise((resolve, reject) => restartedServer.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()))
    const restartedAddress = restartedServer.address()
    const restartedUrl = `http://127.0.0.1:${restartedAddress.port}`
    const restartedSession = await (await fetch(`${restartedUrl}/api/auth/session`, { headers: { Cookie: renewedCookie } })).json()
    const restartedWorkspace = await (await fetch(`${restartedUrl}/api/data`, { headers: { Cookie: renewedCookie } })).json()
    assert.equal(restartedSession.user.id, session.user.id)
    assert.equal(restartedWorkspace.prospects[0].company, 'Empresa Persistida')
    await new Promise((resolve, reject) => restartedServer.close((error) => error ? reject(error) : resolve()))
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test('production requires explicit setup secrets and marks session cookies Secure', async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'crm-production-'))
  const previousEnvironment = Object.fromEntries(['NODE_ENV', 'CRM_ALLOWED_ORIGINS', 'CRM_BOOTSTRAP_TOKEN', 'CRM_OWNER_EMAIL'].map((key) => [key, process.env[key]]))
  let server

  try {
    process.env.NODE_ENV = 'production'
    process.env.CRM_ALLOWED_ORIGINS = 'https://crm.example.com'
    process.env.CRM_BOOTSTRAP_TOKEN = 'a'.repeat(64)
    process.env.CRM_OWNER_EMAIL = 'admin@example.com'
    server = createApiServer({ dataDirectory })
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()))
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://crm.example.com' },
      body: JSON.stringify({ email: 'admin@example.com', name: 'Admin', password: 'Production-Password-123!', bootstrapToken: process.env.CRM_BOOTSTRAP_TOKEN }),
    })
    assert.equal(response.status, 201)
    assert.match(response.headers.getSetCookie()[0], /; Secure(?:;|$)/)
  } finally {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test('local password recovery updates the hash and revokes existing sessions', async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'crm-password-reset-'))
  const account = { id: 123, email: 'admin@example.com', passwordSalt: randomBytes(16).toString('hex'), passwordHash: randomBytes(64).toString('hex') }
  const existingSessionToken = 'sensitive-session-token'
  const sessionHash = createHash('sha256').update(existingSessionToken).digest('hex')

  try {
    await writeFile(path.join(dataDirectory, 'accounts.json'), JSON.stringify([account]))
    const initialStore = createStore(dataDirectory)
    initialStore.createSession(sessionHash, account.id, Date.now() + 60_000)
    initialStore.close()

    const newPassword = 'New-Admin-Password-482!'
    await resetAccountPassword({ dataDirectory, email: account.email, password: newPassword })
    const updatedAccount = JSON.parse(await readFile(path.join(dataDirectory, 'accounts.json'), 'utf8'))[0]
    const actualHash = await deriveKey(newPassword, Buffer.from(updatedAccount.passwordSalt, 'hex'), 64)
    const expectedHash = Buffer.from(updatedAccount.passwordHash, 'hex')
    assert.equal(expectedHash.length, actualHash.length)
    assert.equal(timingSafeEqual(expectedHash, actualHash), true)

    const updatedStore = createStore(dataDirectory)
    assert.equal(updatedStore.getSession(sessionHash), undefined)
    updatedStore.close()
    await assert.rejects(resetAccountPassword({ dataDirectory, email: account.email, password: 'short' }), /12 e 1024/)
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test('saving a workspace name prevents later legacy import from replacing it', async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'crm-workspace-name-'))

  try {
    let store = createStore(dataDirectory)
    store.setWorkspaceName('NewType')
    store.close()

    store = createStore(dataDirectory)
    assert.equal(store.getWorkspace().workspaceName, 'NewType')
    assert.equal(store.getWorkspace().initialized, true)
    assert.equal(store.importWorkspace({ prospects: [], leads: [], followUps: [], companyChanges: [], workspaceName: 'Agência Aurora' }), false)
    assert.equal(store.getWorkspace().workspaceName, 'NewType')
    store.close()
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})