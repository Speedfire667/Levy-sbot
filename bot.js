const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');

const PORT = 8080;
let clients = [];
let bot = null;
let reconnectTimeout = null;
let moveInterval = null;
let updateInterval = null;
let connectTimeout = null;

// === FUNÇÃO DE LOG E BROADCAST ===
function logVision(text) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${text}`;
  console.log(logLine);
  broadcast({ log: logLine });
}

function broadcast(data) {
  const json = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
}

// === CRIAR BOT ===
function createBot() {
  if (bot !== null) {
    logVision('Bot já está ativo, não criando outro.');
    return;
  }

  const username = `ByteBot_${Math.floor(Math.random() * 9999)}`;
  logVision(`🤖 Tentando criar bot com usuário: ${username}`);

  bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me',
    port: 36424,
    username,
    version: '1.12.2',
    auth: 'offline',
  });

  // Timeout para detectar se a conexão está travada (ex: servidor inacessível)
  connectTimeout = setTimeout(() => {
    logVision('⏰ Timeout: bot demorou para conectar, encerrando tentativa.');
    bot.quit();
    cleanupBot();
    scheduleReconnect();
  }, 15000); // 15 segundos para conectar

  bot.once('spawn', () => {
    clearTimeout(connectTimeout);
    logVision(`✅ Bot conectado: ${bot.username}`);

    // Intervalo de movimentação para evitar kick
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = setInterval(() => {
      if (!bot.entity) return;
      const directions = ['forward', 'back', 'left', 'right'];
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const jump = Math.random() < 0.3;

      bot.clearControlStates();
      bot.setControlState(dir, true);
      if (jump) bot.setControlState('jump', true);

      setTimeout(() => bot.clearControlStates(), 1000);
    }, 8000);

    // Intervalo para enviar posição e jogadores
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
        pos: p.entity ? { x: p.entity.position.x, y: p.entity.position.y, z: p.entity.position.z } : null
      }));

      broadcast({ position, players });
    }, 1000);
  });

  bot.on('chat', (username, message) => {
    if (username !== bot.username) {
      logVision(`💬 ${username}: ${message}`);
    }
  });

  bot.once('end', () => {
    logVision('🔴 Bot desconectado');
    cleanupBot();
    scheduleReconnect();
  });

  bot.once('kicked', (reason, loggedIn) => {
    logVision(`🚫 Bot kickado: ${reason} (logado? ${loggedIn})`);
    cleanupBot();
    scheduleReconnect();
  });

  bot.on('error', err => {
    logVision(`❌ Erro do bot: ${err.message}`);
    cleanupBot();
    scheduleReconnect();
  });

  bot.on('login', () => {
    logVision('🔑 Bot fez login no servidor.');
  });
}

// Função para limpar intervals e resetar variável bot
function cleanupBot() {
  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (connectTimeout) {
    clearTimeout(connectTimeout);
    connectTimeout = null;
  }
  if (bot) {
    try {
      bot.quit();
    } catch (_) {}
  }
  bot = null;
}

// === RECONEXÃO ===
function scheduleReconnect() {
  if (reconnectTimeout) {
    logVision('Já há uma reconexão agendada, ignorando nova.');
    return;
  }
  logVision('⏳ Reconectando em 10 segundos...');
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    createBot();
  }, 10000);
}

// === SERVIDOR HTTP + WEBSOCKET ===
const html = `<!DOCTYPE html>
<html>
<head>
  <title>Visão ByteBot</title>
  <style>
    body { background: #111; color: #eee; font-family: sans-serif; text-align: center; }
    canvas { background: #222; border: 2px solid #444; }
    #log { max-height: 200px; overflow-y: auto; list-style: none; padding: 0; }
    #log li { border-bottom: 1px solid #333; padding: 2px 6px; font-size: 14px; }
  </style>
</head>
<body>
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
        if (logEl.children.length > 20) logEl.removeChild(logEl.lastChild);
      }
    };
    socket.onerror = e => {
      console.error('WebSocket error:', e);
      const li = document.createElement('li');
      li.textContent = '[WebSocket] Erro na conexão';
      logEl.prepend(li);
    };
    socket.onclose = e => {
      const li = document.createElement('li');
      li.textContent = '[WebSocket] Conexão fechada';
      logEl.prepend(li);
    };

    function draw() {
      ctx.clearRect(0, 0, 400, 400);
      const cx = 200, cz = 200;

      // Bot
      ctx.fillStyle = 'lime';
      ctx.beginPath();
      ctx.arc(cx, cz, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Players
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
</body>
</html>`;

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

wss.on('connection', (ws) => {
  clients.push(ws);
  logVision('📡 Cliente conectado');

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    logVision('🔌 Cliente desconectado');
  });

  ws.on('error', (err) => {
    logVision(`❌ Erro WebSocket cliente: ${err.message}`);
  });
});

// === INICIAR SERVIDOR E BOT ===
server.listen(PORT, () => {
  console.log(`🌍 Acesse http://localhost:${PORT}`);
  logVision(`Servidor iniciado na porta ${PORT}`);
  createBot();
});
