const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configurações
const HTTP_PORT = 8080;
const LOG_PATH = path.resolve(__dirname, 'bot_vision.log');

let clients = [];
let bot = null;
let reconnectTimeout = null;
let isReconnecting = false;

// Função para escrever no log
function logVision(text) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${text}`;
  console.log(logLine); // Log no terminal
  fs.appendFile(LOG_PATH, logLine + '\n', (err) => {
    if (err) console.error('[LOG ERROR] Não foi possível salvar log:', err);
  });
}

// Cria o bot
function createBot() {
  if (bot !== null) {
    logVision('🛑 Tentativa de criar bot quando já existe.');
    return;
  }

  const username = `ByteBot_${Math.floor(Math.random() * 10000)}`;
  logVision(`🟢 Criando bot com username: ${username}`);

  bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me',
    port: 36424,
    username: username,
    version: '1.19.3', // ou use 'auto' se quiser tentar automático
    auth: 'offline'
  });

  // Se reconectando, limpa timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Eventos do bot
  bot.on('spawn', () => {
    logVision(`✅ Bot ${bot.username} entrou no servidor!`);

    const updateInterval = setInterval(() => {
      if (!bot?.entity) return;

      const position = bot.entity.position;
      const players = Object.values(bot.players).map(p => ({
        username: p.username,
        pos: p.entity ? p.entity.position : null
      }));

      broadcast({ position, players });

      logVision(`📍 Posição: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)} | Jogadores online: ${players.length}`);
    }, 1000);

    // Quando o bot sai
    bot.on('end', () => {
      logVision('🔴 Bot desconectado do servidor.');
      clearInterval(updateInterval);
      scheduleReconnect();
    });

    // Quando é kickado
    bot.on('kicked', (reason, loggedIn) => {
      logVision(`⚠️ Bot foi kickado: ${reason}`);
      clearInterval(updateInterval);
      scheduleReconnect();
    });

    // Comando no chat para debug (opcional)
    bot.on('chat', (username, message) => {
      if (username === bot.username) return;
      logVision(`💬 ${username}: ${message}`);
    });
  });

  // Erros
  bot.on('error', (err) => {
    logVision(`❌ Erro no bot: ${err.stack}`);
    scheduleReconnect();
  });
}

// Reconexão com proteção
function scheduleReconnect() {
  if (isReconnecting) {
    logVision('🔁 Já há uma tentativa de reconexão em andamento.');
    return;
  }

  isReconnecting = true;
  if (bot) {
    bot.removeAllListeners();
    bot = null;
  }

  logVision('⏳ Tentando reconectar em 10 segundos...');
  reconnectTimeout = setTimeout(() => {
    isReconnecting = false;
    createBot();
  }, 10000);
}

// Envia dados a todos os clientes WebSocket
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        logVision(`⚠️ Erro ao enviar dados para cliente WebSocket: ${err.message}`);
      }
    }
  });
}

// Servidor HTTP (simples, só pra manter vivo)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor do ByteBot online!');
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  logVision('📡 Novo cliente WebSocket conectado!');
  clients.push(ws);

  ws.on('close', () => {
    logVision('🔌 Cliente WebSocket desconectado.');
    clients = clients.filter(client => client !== ws);
  });

  ws.on('error', (err) => {
    logVision(`⚠️ Erro em conexão WebSocket: ${err.message}`);
  });
});

// Iniciar servidor
server.listen(HTTP_PORT, () => {
  logVision(`🚀 Servidor HTTP/WebSocket rodando na porta ${HTTP_PORT}`);
  createBot();
});
