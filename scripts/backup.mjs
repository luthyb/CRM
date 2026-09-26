import { backup, DatabaseSync } from 'node:sqlite'
import { chmod, copyFile, mkdir, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = process.env.CRM_DATA_DIR ? path.resolve(process.env.CRM_DATA_DIR) : path.join(rootDirectory, 'data')
const backupDirectory = process.env.CRM_BACKUP_DIR ? path.resolve(process.env.CRM_BACKUP_DIR) : path.join(dataDirectory, 'backups')
const databasePath = path.join(dataDirectory, 'crm.sqlite')
const accountsPath = path.join(dataDirectory, 'accounts.json')
const keepCount = 30

await mkdir(backupDirectory, { recursive: true, mode: 0o700 })
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = path.join(backupDirectory, `crm-${timestamp}.sqlite`)
const database = new DatabaseSync(databasePath, { readOnly: true })

try {
  await backup(database, backupPath)
} finally {
  database.close()
}

await chmod(backupPath, 0o600)
const accountsBackupPath = backupPath.replace(/\.sqlite$/, '.accounts.json')
try {
  await copyFile(accountsPath, accountsBackupPath)
  await chmod(accountsBackupPath, 0o600)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const existingBackups = (await readdir(backupDirectory))
  .filter((name) => /^crm-\d{4}-\d{2}-\d{2}T.*\.sqlite$/.test(name))
  .sort()
for (const oldBackup of existingBackups.slice(0, Math.max(0, existingBackups.length - keepCount))) {
  await unlink(path.join(backupDirectory, oldBackup))
  await unlink(path.join(backupDirectory, oldBackup.replace(/\.sqlite$/, '.accounts.json'))).catch(() => {})
}
console.log(`Backup criado: ${backupPath}`)
