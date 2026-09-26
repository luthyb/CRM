import { DatabaseSync } from 'node:sqlite'
import { chmodSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const collections = ['prospects', 'leads', 'followUps', 'companyChanges']

export function createStore(dataDirectory) {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 })
  chmodSync(dataDirectory, 0o700)
  const databasePath = path.join(dataDirectory, 'crm.sqlite')
  const database = new DatabaseSync(databasePath)
  try {
    chmodSync(databasePath, 0o600)
  } catch {}
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS crm_records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE TABLE IF NOT EXISTS crm_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crm_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
  database.prepare("INSERT OR IGNORE INTO crm_settings (key, value) VALUES ('workspace_name', 'Agência Aurora')").run()
  database.prepare("INSERT OR IGNORE INTO crm_settings (key, value) VALUES ('workspace_initialized', 'false')").run()

  const getWorkspace = () => {
    const rows = database.prepare('SELECT collection, payload FROM crm_records ORDER BY rowid').all()
    const workspace = Object.fromEntries(collections.map((collection) => [collection, []]))
    for (const row of rows) workspace[row.collection].push(JSON.parse(row.payload))
    const settings = database.prepare('SELECT key, value FROM crm_settings').all()
    const values = Object.fromEntries(settings.map(({ key, value }) => [key, value]))
    return {
      ...workspace,
      workspaceName: values.workspace_name || 'Agência Aurora',
      initialized: values.workspace_initialized === 'true',
    }
  }

  const updateCollection = (collection, { upsert, delete: deletedIds }) => {
    if (!collections.includes(collection)) throw new Error('Coleção inválida.')
    const update = database.prepare('INSERT INTO crm_records (collection, id, payload) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET payload = excluded.payload')
    const remove = database.prepare('DELETE FROM crm_records WHERE collection = ? AND id = ?')
    database.exec('BEGIN IMMEDIATE')
    try {
      for (const item of upsert) update.run(collection, String(item.id), JSON.stringify(item))
      for (const id of deletedIds) remove.run(collection, String(id))
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  const importWorkspace = (workspace) => {
    database.exec('BEGIN IMMEDIATE')
    try {
      const initialized = database.prepare("SELECT value FROM crm_settings WHERE key = 'workspace_initialized'").get()
      const recordCount = database.prepare('SELECT COUNT(*) AS count FROM crm_records').get().count
      if (initialized.value === 'true' || recordCount > 0) {
        database.exec('ROLLBACK')
        return false
      }
      const insert = database.prepare('INSERT INTO crm_records (collection, id, payload) VALUES (?, ?, ?)')
      for (const collection of collections) {
        for (const item of workspace[collection]) insert.run(collection, String(item.id), JSON.stringify(item))
      }
      database.prepare("UPDATE crm_settings SET value = ? WHERE key = 'workspace_name'").run(workspace.workspaceName)
      database.prepare("UPDATE crm_settings SET value = 'true' WHERE key = 'workspace_initialized'").run()
      database.exec('COMMIT')
      return true
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  const replaceWorkspace = (workspace) => {
    database.exec('BEGIN IMMEDIATE')
    try {
      database.exec('DELETE FROM crm_records')
      const insert = database.prepare('INSERT INTO crm_records (collection, id, payload) VALUES (?, ?, ?)')
      for (const collection of collections) {
        for (const item of workspace[collection]) insert.run(collection, String(item.id), JSON.stringify(item))
      }
      database.prepare("UPDATE crm_settings SET value = ? WHERE key = 'workspace_name'").run(workspace.workspaceName)
      database.prepare("UPDATE crm_settings SET value = 'true' WHERE key = 'workspace_initialized'").run()
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  const setWorkspaceName = (name) => {
    database.exec('BEGIN IMMEDIATE')
    try {
      database.prepare("UPDATE crm_settings SET value = ? WHERE key = 'workspace_name'").run(name)
      database.prepare("UPDATE crm_settings SET value = 'true' WHERE key = 'workspace_initialized'").run()
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  const createSession = (tokenHash, userId, expiresAt) => {
    database.prepare('INSERT INTO crm_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt)
  }

  const getSession = (tokenHash) => database.prepare('SELECT user_id AS userId, expires_at AS expiresAt FROM crm_sessions WHERE token_hash = ?').get(tokenHash)
  const deleteSession = (tokenHash) => database.prepare('DELETE FROM crm_sessions WHERE token_hash = ?').run(tokenHash)
  const deleteUserSessions = (userId) => database.prepare('DELETE FROM crm_sessions WHERE user_id = ?').run(userId)
  const close = () => database.close()

  return { getWorkspace, updateCollection, importWorkspace, replaceWorkspace, setWorkspaceName, createSession, getSession, deleteSession, deleteUserSessions, close }
}
