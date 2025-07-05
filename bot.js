const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const HTTP_PORT = 8080;
const LOG_PATH = path.resolve(__dirname, 'bot_vision.log');

let clients = [];
let bot = null;
let reconnectInterval = null;

// Função de log melhorada
function logVision(text) {
  const timestamp = new Date().toISOString();
  fs.appendFile(LOG_PATH, `[${timestamp}] ${text}\n`, (err) => {
    if (err) console.error('Erro ao escrever no log:', err);
  });
}

function createBot() {
  // Se já existe um bot, não criar outro
  if (bot !== null) return;

  const username = `ByteBot_${Math.floor(Math.random() * 10000)}`;
  console.log(`🟢 Tentando conectar como ${username}`);

  bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me',
    port: 36424,
    username: username,
    version: '1.12.2',
    auth: 'offline'
  });

  // Limpa o intervalo de reconexão se existir
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }

  bot.on('spawn', () => {
    console.log(`✅ Conectado com sucesso como ${bot.username}`);
    
    // Intervalo para enviar dados
    const updateInterval = setInterval(() => {
      if (!bot.entity) return;

      const position = bot.entity.position;
      const players = Object.values(bot.players).map(p => ({
        username: p.username,
        pos: p.entity ? p.entity.position : null,
      }));

      broadcast({ position, players });
      logVision(`Posição: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)} | Jogadores: ${players.length}`);
    }, 1000);

    bot.on('end', () => {
      console.log('🔴 Conexão encerrada');
      clearInterval(updateInterval);
      scheduleReconnect();
    });
  });

  bot.on('error', (err) => {
    console.log(`❌ Erro: ${err.message}`);
    scheduleReconnect();
  });

  function scheduleReconnect() {
    if (bot) {
      bot.removeAllListeners();
      bot = null;
    }

    if (!reconnectInterval) {
      console.log('⏳ Tentando reconectar em 10 segundos...');
      reconnectInterval = setTimeout(() => {
        createBot();
      }, 10000);
    }
  }
}

// Restante do código (WebSocket server, broadcast, etc.) permanece igual
