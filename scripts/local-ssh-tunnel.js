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

const RECONNECT_DELAY_MS = 5000
const KEEPALIVE_INTERVAL_MS = 10000
const KEEPALIVE_COUNT_MAX = 3

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

let tcpServer = null
let reconnecting = false

function closeTcpServer(cb) {
  if (!tcpServer) return cb && cb()
  tcpServer.close(() => {
    tcpServer = null
    cb && cb()
  })
  // force-close existing connections so server.close resolves fast
  tcpServer.closeAllConnections?.()
}

function connect() {
  reconnecting = false
  const ssh = new Client()

  ssh.on('ready', () => {
    write(logPath, `SSH ready: ${host}. Listening 127.0.0.1:${localPort} -> ${remoteHost}:${remotePort}`)

    closeTcpServer(() => {
      tcpServer = net.createServer((socket) => {
        let stream = null
        socket.on('error', (err) => {
          write(errPath, `socket error: ${err.message}`)
          if (stream) stream.destroy()
        })

        // forwardOut pode lancar SINCRONO ("Not connected") se a sessao SSH caiu;
        // envolver em try/catch evita derrubar o processo e dispara o reconnect
        try {
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
              stream.on('error', (err) => {
                write(errPath, `stream error: ${err.message}`)
                socket.destroy()
              })
              socket.pipe(stream).pipe(socket)
            }
          )
        } catch (err) {
          write(errPath, `forwardOut throw: ${err.message}`)
          socket.destroy()
          scheduleReconnect(ssh)
        }
      })

      tcpServer.on('error', (err) => {
        write(errPath, `server error: ${err.message}`)
        // EADDRINUSE: previous server not closed yet, retry
        if (err.code === 'EADDRINUSE') {
          setTimeout(() => connect(), RECONNECT_DELAY_MS)
        }
      })

      tcpServer.listen(localPort, '127.0.0.1', () => write(logPath, 'Tunnel listening'))
    })
  })

  ssh.on('error', (error) => {
    write(errPath, `ssh error: ${error.message}`)
    scheduleReconnect(ssh)
  })

  ssh.on('close', () => {
    write(logPath, `SSH closed. Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`)
    scheduleReconnect(ssh)
  })

  ssh.connect({
    host,
    port: 22,
    username,
    ...(privateKey ? { privateKey } : { password }),
    keepaliveInterval: KEEPALIVE_INTERVAL_MS,
    keepaliveCountMax: KEEPALIVE_COUNT_MAX,
    readyTimeout: 12000,
  })
}

function scheduleReconnect(ssh) {
  if (reconnecting) return
  reconnecting = true
  try { ssh.destroy() } catch {}
  setTimeout(connect, RECONNECT_DELAY_MS)
}

connect()
