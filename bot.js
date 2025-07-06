const mineflayer = require('mineflayer');

let bot = null;
let moveInterval = null;
let reconnectTimeout = null;

function createBot() {
  if (bot) return;

  const username = `ByteBot_${Math.floor(Math.random() * 9999)}`;
  console.log(`[BOT] Criando bot: ${username}`);

  bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me',
    port: 36424,
    username: username,
    version: '1.12.2',
    auth: 'offline',
  });

  // === EVENTOS ===

  bot.on('spawn', () => {
    console.log(`[SPAWN] ${bot.username} entrou no mundo!`);
    startMovement();
  });

  bot.on('login', () => {
    console.log('[LOGIN] Bot autenticado no servidor.');
  });

  bot.on('chat', (username, message) => {
    if (username !== bot.username) {
      console.log(`[CHAT] ${username}: ${message}`);
    }
  });

  bot.on('end', () => {
    console.log('[END] Bot desconectado!');
    cleanupAndReconnect();
  });

  bot.on('kicked', (reason) => {
    console.log(`[KICKED] Motivo: ${reason}`);
    cleanupAndReconnect();
  });

  bot.on('error', (err) => {
    console.log(`[ERROR] Erro: ${err.message}`);
    cleanupAndReconnect();
  });
}

function startMovement() {
  if (moveInterval) clearInterval(moveInterval);

  moveInterval = setInterval(() => {
    if (!bot || !bot.entity) return;

    const directions = ['forward', 'back', 'left', 'right'];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const jump = Math.random() < 0.3;

    bot.clearControlStates();
    bot.setControlState(dir, true);
    if (jump) bot.setControlState('jump', true);

    setTimeout(() => bot.clearControlStates(), 1000);
  }, 8000);
}

function cleanupAndReconnect() {
  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }

  if (bot) {
    try {
      bot.quit();
    } catch (_) {}
    bot = null;
  }

  if (reconnectTimeout) return;

  console.log('[RECONNECT] Tentando reconectar em 10 segundos...');
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    createBot();
  }, 10000);
}

// Inicia o bot pela primeira vez
createBot();
