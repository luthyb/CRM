import { spawn } from 'node:child_process'
import path from 'node:path'

const preview = process.argv.includes('--preview')
const api = spawn(process.execPath, [path.resolve('server/index.mjs')], { stdio: 'inherit' })
const children = [api]
let shuttingDown = false

function stop(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = code
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
api.on('error', (error) => {
  console.error(error)
  stop(1)
})
api.on('exit', (code) => {
  if (!shuttingDown) stop(code ?? 1)
})

async function waitForApi() {
  while (!shuttingDown) {
    if (api.exitCode !== null) throw new Error('A API local não iniciou.')
    try {
      const response = await fetch('http://127.0.0.1:5174/api/health')
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}

try {
  await waitForApi()
  if (shuttingDown) process.exit(1)
  const viteArguments = [path.resolve('node_modules/vite/bin/vite.js')]
  if (preview) viteArguments.push('preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort')
  else viteArguments.push('--host', '127.0.0.1')
  const frontend = spawn(process.execPath, viteArguments, { stdio: 'inherit' })
  children.push(frontend)
  frontend.on('error', (error) => {
    console.error(error)
    stop(1)
  })
  frontend.on('exit', (code) => {
    if (!shuttingDown) stop(code ?? 1)
  })
} catch (error) {
  console.error(error)
  stop(1)
}