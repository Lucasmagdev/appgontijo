const net = require('net')
const fs = require('fs')
const { Client } = require('ssh2')

const host = process.env.VPS_HOST || '129.212.189.135'
const username = process.env.VPS_USER || 'root'
const password = process.env.VPS_PASSWORD
const localPort = Number(process.env.LOCAL_PORT || 3307)
const remoteHost = process.env.REMOTE_HOST || '127.0.0.1'
const remotePort = Number(process.env.REMOTE_PORT || 3306)

const logPath = process.env.TUNNEL_LOG || 'ssh-tunnel.log'
const errPath = process.env.TUNNEL_ERR || 'ssh-tunnel.err.log'

const os = require('os')
const path = require('path')
const defaultKeyPaths = [
  path.join(os.homedir(), '.ssh', 'id_ed25519'),
  path.join(os.homedir(), '.ssh', 'id_rsa'),
]
const privateKey = defaultKeyPaths.reduce((found, p) => {
  if (found) return found
  try { return fs.readFileSync(p) } catch { return null }
}, null)

function write(file, message) {
  fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`)
}

if (!password && !privateKey) {
  write(errPath, 'VPS_PASSWORD or SSH key required')
  process.exit(1)
}

const ssh = new Client()

ssh.on('ready', () => {
  write(logPath, `SSH ready: ${host}. Listening 127.0.0.1:${localPort} -> ${remoteHost}:${remotePort}`)

  const server = net.createServer((socket) => {
    let stream = null
    socket.on('error', (socketError) => {
      write(errPath, `socket error: ${socketError.message}`)
      if (stream) stream.destroy()
    })

    ssh.forwardOut(
      socket.remoteAddress || '127.0.0.1',
      socket.remotePort || 0,
      remoteHost,
      remotePort,
      (error, forwardedStream) => {
        if (error) {
          write(errPath, `forwardOut error: ${error.message}`)
          socket.destroy()
          return
        }

        stream = forwardedStream

        stream.on('error', (streamError) => {
          write(errPath, `stream error: ${streamError.message}`)
          socket.destroy()
        })

        socket.pipe(stream).pipe(socket)
      }
    )
  })

  server.on('error', (error) => {
    write(errPath, `server error: ${error.message}`)
    process.exit(2)
  })

  server.listen(localPort, '127.0.0.1', () => write(logPath, 'Tunnel listening'))
})

ssh.on('error', (error) => {
  write(errPath, `ssh error: ${error.message}`)
  process.exit(1)
})

ssh.on('close', () => write(logPath, 'SSH closed'))

ssh.connect({
  host,
  port: 22,
  username,
  ...(privateKey ? { privateKey } : { password }),
  keepaliveInterval: 15000,
  readyTimeout: 12000,
})
