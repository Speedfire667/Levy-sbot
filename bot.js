const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// CONFIGS
const PORT = 8080;
let clients = [];
let bot = null;
let reconnectTimeout = null;
let isReconnecting = false;

// FUNÇÃO DE LOG
function logVision(text) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${text}`;
  console.log(logLine);
  broadcast({ log: logLine });
}

// FUNÇÃO PRA CRIAR O BOT
function createBot() {
  if (bot !== null) {
    logVision('⚠️ Bot já existe. Cancelando criação.');
    return;
  }

  const username = `ByteBot_${Math.floor(Math.random() * 10000)}`;
  logVision(`🤖 Criando bot como ${username}`);

  bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me',
    port: 36424,
    username: username,
    version: '1.12.2', // 👈 Versão certa!
    auth: 'offline'
  });

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  bot.on('spawn', () => {
    logVision(`✅ Bot conectado: ${bot.username}`);

    const interval = setInterval(() => {
      if (!bot.entity) return;

      const position = bot.entity.position;
      const players = Object.values(bot.players).map(p => ({
        username: p.username,
        pos: p.entity ? p.entity.position : null
      }));

      broadcast({ position, players });
    }, 1000);

    bot.once('end', () => {
      logVision('🔴 Bot desconectado.');
      clearInterval(interval);
      scheduleReconnect();
    });

    bot.once('kicked', reason => {
      logVision(`🚫 Bot kickado: ${reason}`);
      clearInterval(interval);
      scheduleReconnect();
    });

    bot.on('chat', (username, message) => {
      if (username !== bot.username) {
        logVision(`💬 ${username}: ${message}`);
      }
    });
  });

  bot.on('error', (err) => {
    logVision(`❌ Erro no bot: ${err.message}`);
    scheduleReconnect();
  });
}

// RECONNECT
function scheduleReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;

  if (bot) {
    try {
      bot.removeAllListeners();
    } catch {}
    bot = null;
  }

  logVision('⏳ Reconectando em 10 segundos...');
  reconnectTimeout = setTimeout(() => {
    isReconnecting = false;
    createBot();
  }, 10000);
}

// BROADCAST PARA TODOS OS CLIENTES
function broadcast(data) {
  const json = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
}

// ==== SERVIDOR HTTP + WEBSOCKET ====
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(htmlContent);
  } else if (req.url === '/style.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    return res.end(cssContent);
  } else if (req.url === '/client.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(jsContent);
  } else {
    res.writeHead(404);
    return res.end('404 Not Found');
  }
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  clients.push(ws);
  logVision('📡 Novo cliente conectado.');

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    logVision('🔌 Cliente desconectado.');
  });

  ws.on('error', err => {
    logVision(`⚠️ WS erro: ${err.message}`);
  });
});

// ==== INICIA SERVIDOR E BOT ====
server.listen(PORT, () => {
  console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
  createBot();
});

// ==== HTML EMBUTIDO ====
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Visão do ByteBot</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>👁️ Visão do ByteBot</h1>
  <div id="status">Status: <span class="ok">🟢 Online</span></div>
  <canvas id="radar" width="400" height="400"></canvas>
  <h2>📋 Últimos eventos</h2>
  <ul id="log"></ul>
  <script src="/client.js"></script>
</body>
</html>
`;

// ==== CSS EMBUTIDO ====
const cssContent = `
body {
  font-family: sans-serif;
  background: #111;
  color: #eee;
  text-align: center;
  padding: 20px;
}
canvas {
  background: #222;
  border: 2px solid #444;
  margin: 10px;
}
#log {
  list-style: none;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  margin: 0 auto;
  width: 400px;
  background: #1a1a1a;
  border-radius: 5px;
  font-size: 14px;
}
#log li {
  padding: 4px 8px;
  border-bottom: 1px solid #333;
}
.ok { color: lightgreen; }
`;

// ==== JAVASCRIPT EMBUTIDO ====
const jsContent = `
const logEl = document.getElementById('log');
const radar = document.getElementById('radar');
const ctx = radar.getContext('2d');
let botPos = { x: 0, z: 0 };
let players = [];

const socket = new WebSocket('ws://' + location.host);

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.position) {
    botPos = data.position;
  }
  if (data.players) {
    players = data.players;
  }
  if (data.log) {
    const li = document.createElement('li');
    li.textContent = data.log;
    logEl.prepend(li);
    if (logEl.childNodes.length > 20) {
      logEl.removeChild(logEl.lastChild);
    }
  }
};

function drawRadar() {
  ctx.clearRect(0, 0, radar.width, radar.height);
  const centerX = radar.width / 2;
  const centerY = radar.height / 2;

  // Desenha o bot
  ctx.fillStyle = 'lime';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
  ctx.fill();

  // Outros jogadores
  players.forEach(p => {
    if (!p.pos) return;
    const dx = p.pos.x - botPos.x;
    const dz = p.pos.z - botPos.z;
    const scale = 2;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(centerX + dx * scale, centerY + dz * scale, 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  requestAnimationFrame(drawRadar);
}
drawRadar();
`;
