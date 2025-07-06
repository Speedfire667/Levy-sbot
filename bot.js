const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');

// ========== CONFIG ==========
const MC_HOST = 'Speedfire1237.aternos.me';
const MC_PORT = 36424; // 🚨 MUITO IMPORTANTE! SEM ISSO NÃO FUNCIONA!
const VERSION = '1.12.2';
const PORT = process.env.PORT || 8080; // para Render ou local

let bot = null;
let clients = [];
let reconnectTimeout = null;
let moveInterval = null;
let updateInterval = null;
let connectTimeout = null;

// ========== LOG + BROADCAST ==========
function logVision(text) {
  const logLine = `[${new Date().toISOString()}] ${text}`;
  console.log(logLine);
  broadcast({ log: logLine });
}

function broadcast(data) {
  const json = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  });
}

// ========== BOT ==========
function createBot() {
  if (bot) {
    logVision('⚠️ Bot já está ativo.');
    return;
  }

  const username = `ByteBot_${Math.floor(Math.random() * 9999)}`;
  logVision(`🤖 Iniciando bot como ${username}...`);

  bot = mineflayer.createBot({
    host: MC_HOST,
    port: MC_PORT,
    username,
    version: VERSION,
    auth: 'offline',
  });

  connectTimeout = setTimeout(() => {
    logVision('⏰ Timeout: conexão muito demorada.');
    bot.quit();
    cleanupBot();
    scheduleReconnect();
  }, 15000);

  bot.once('spawn', () => {
    clearTimeout(connectTimeout);
    logVision(`✅ Bot conectado: ${bot.username}`);

    if (moveInterval) clearInterval(moveInterval);
    moveInterval = setInterval(() => {
      if (!bot.entity) return;
      const dirs = ['forward', 'back', 'left', 'right'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const jump = Math.random() < 0.4;

      bot.clearControlStates();
      bot.setControlState(dir, true);
      if (jump) bot.setControlState('jump', true);

      setTimeout(() => bot.clearControlStates(), 1000);
    }, 8000);

    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
      if (!bot.entity) return;
      const position = {
        x: bot.entity.position.x,
        y: bot.entity.position.y,
        z: bot.entity.position.z,
      };
      const players = Object.values(bot.players).map(p => ({
        username: p.username,
        pos: p.entity ? {
          x: p.entity.position.x,
          y: p.entity.position.y,
          z: p.entity.position.z
        } : null
      }));
      broadcast({ position, players });
    }, 1000);
  });

  bot.on('chat', (username, msg) => {
    if (username !== bot.username)
      logVision(`💬 ${username}: ${msg}`);
  });

  bot.once('end', () => {
    logVision('🔴 Bot desconectado');
    cleanupBot();
    scheduleReconnect();
  });

  bot.once('kicked', (reason, loggedIn) => {
    logVision(`🚫 Bot kickado: ${reason}`);
    cleanupBot();
    scheduleReconnect();
  });

  bot.on('error', err => {
    logVision(`❌ Erro: ${err.message}`);
    cleanupBot();
    scheduleReconnect();
  });

  bot.on('login', () => {
    logVision('🔐 Bot logado com sucesso!');
  });
}

function cleanupBot() {
  if (moveInterval) clearInterval(moveInterval);
  if (updateInterval) clearInterval(updateInterval);
  if (connectTimeout) clearTimeout(connectTimeout);
  try {
    if (bot) bot.quit();
  } catch (_) {}
  bot = null;
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  logVision('🔄 Tentando reconectar em 10 segundos...');
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    createBot();
  }, 10000);
}

// ========== INTERFACE HTML ==========
const html = `<!DOCTYPE html>
<html><head><title>Radar ByteBot</title>
  <style>
    body { background: #111; color: #eee; font-family: sans-serif; text-align: center; }
    canvas { background: #222; border: 2px solid #444; margin: 16px 0; }
    #log { max-height: 200px; overflow-y: auto; list-style: none; padding: 0; margin: 0 auto; width: 90%; text-align: left; }
    #log li { border-bottom: 1px solid #333; padding: 4px 8px; font-size: 14px; }
  </style>
</head><body>
  <h1>👁️ Radar do ByteBot</h1>
  <canvas id="radar" width="400" height="400"></canvas>
  <ul id="log"></ul>
  <script>
    const canvas = document.getElementById('radar');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('log');
    let botPos = { x: 0, z: 0 };
    let players = [];

    const socket = new WebSocket('ws://' + location.host);
    socket.onmessage = e => {
      const data = JSON.parse(e.data);
      if (data.position) botPos = data.position;
      if (data.players) players = data.players;
      if (data.log) {
        const li = document.createElement('li');
        li.textContent = data.log;
        logEl.prepend(li);
        if (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
      }
    };
    socket.onerror = () => {
      const li = document.createElement('li');
      li.textContent = '[WebSocket] Erro de conexão';
      logEl.prepend(li);
    };
    socket.onclose = () => {
      const li = document.createElement('li');
      li.textContent = '[WebSocket] Conexão fechada';
      logEl.prepend(li);
    };

    function draw() {
      ctx.clearRect(0, 0, 400, 400);
      const cx = 200, cz = 200;
      ctx.fillStyle = 'lime';
      ctx.beginPath();
      ctx.arc(cx, cz, 6, 0, 2 * Math.PI);
      ctx.fill();
      players.forEach(p => {
        if (!p.pos) return;
        const dx = (p.pos.x - botPos.x) * 2;
        const dz = (p.pos.z - botPos.z) * 2;
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(cx + dx, cz + dz, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body></html>`;

// ========== HTTP + WS ==========
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  } else {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  clients.push(ws);
  logVision('📡 Novo cliente conectado');
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    logVision('🔌 Cliente desconectado');
  });
  ws.on('error', err => {
    logVision(`❗ Erro WS: ${err.message}`);
  });
});

// ========== INÍCIO ==========
server.listen(PORT, () => {
  console.log(`🌐 Servidor Web rodando: http://localhost:${PORT}`);
  createBot();
});
