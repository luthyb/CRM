import { StringDecoder } from 'node:string_decoder'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resetAccountPassword } from '../server/reset-password.mjs'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = process.env.CRM_DATA_DIR ? path.resolve(process.env.CRM_DATA_DIR) : path.join(rootDirectory, 'data')
const email = process.argv[2]?.trim().toLowerCase()

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo para digitar a senha sem exibi-la.')
  }
  const decoder = new StringDecoder('utf8')
  return new Promise((resolve, reject) => {
    let value = ''
    process.stdout.write(prompt)
    const finish = (error) => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003') {
          finish(new Error('Operação cancelada.'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = [...value].slice(0, -1).join('')
        } else if (character >= ' ') {
          value += character
        }
      }
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

try {
  if (!email) throw new Error('Uso: node scripts/reset-admin-password.mjs email@empresa.com')
  const password = await readHidden('Nova senha (mínimo 12 caracteres): ')
  const confirmation = await readHidden('Repita a nova senha: ')
  if (password !== confirmation) throw new Error('As senhas não conferem; nenhuma alteração foi feita.')
  await resetAccountPassword({ dataDirectory, email, password })
  console.log(`Senha redefinida para ${email}. As sessões anteriores foram encerradas.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
