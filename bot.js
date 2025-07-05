const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const HTTP_PORT = 8080;
const LOG_PATH = path.resolve(__dirname, 'bot_vision.log');

let clientes = [];

// Log em arquivo
function logVisao(texto) {
  const dataHora = new Date().toISOString();
  const linha = `[${dataHora}] ${texto}\n`;
  fs.appendFile(LOG_PATH, linha, (err) => {
    if (err) console.error('Erro ao escrever no log:', err);
  });
}

// Página HTML simples
const htmlPagina = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Visão do ByteBot</title>
<style>
  body { background: #111; color: #0f0; font-family: monospace; padding: 20px; }
  h1 { text-align: center; }
</style>
</head>
<body>
  <h1>Visão do ByteBot</h1>
  <p><strong>Posição:</strong> <span id="pos">Aguardando...</span></p>
  <p><strong>Jogadores visíveis:</strong></p>
  <ul id="players"></ul>

  <script>
    const ws = new WebSocket('ws://' + location.host);
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      const pos = data.position;
      const players = data.players;

      document.getElementById('pos').textContent =
        \`X: \${pos.x.toFixed(2)} | Y: \${pos.y.toFixed(2)} | Z: \${pos.z.toFixed(2)}\`;

      const list = document.getElementById('players');
      list.innerHTML = '';
      players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.pos
          ? \`\${p.username} — X:\${p.pos.x.toFixed(1)} Y:\${p.pos.y.toFixed(1)} Z:\${p.pos.z.toFixed(1)}\`
          : \`\${p.username} — sem posição\`;
        list.appendChild(li);
      });
    };
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlPagina);
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  clientes.push(ws);
  ws.on('close', () => clientes = clientes.filter(c => c !== ws));
});

function broadcast(data) {
  const json = JSON.stringify(data);
  clientes.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
}

function gerarNomeAleatorio() {
  const numero = Math.floor(Math.random() * 9999999) + 1;
  return `ByteBot[*_*]#${numero}`;
}

function criarBot() {
  const nome = gerarNomeAleatorio();
  console.log(`🟢 Iniciando bot com nome: ${nome}`);

  const bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me',
    port: 36424,
    username: nome,
    version: '1.19.3' // 👈 TROQUE aqui se a versão do seu servidor for diferente!
  });

  bot.on('spawn', () => {
    console.log(`✅ Conectado como ${bot.username}`);

    setInterval(() => {
      if (!bot.entity) return;

      const pos = bot.entity.position;
      const players = Object.values(bot.players).map(p => ({
        username: p.username,
        pos: p.entity ? p.entity.position : null,
      }));

      broadcast({ position: pos, players });

      let textoLog = `Posição do bot: X:${pos.x.toFixed(2)} Y:${pos.y.toFixed(2)} Z:${pos.z.toFixed(2)} | Jogadores: `;
      textoLog += players.map(p => p.pos
        ? `${p.username} (X:${p.pos.x.toFixed(2)} Y:${p.pos.y.toFixed(2)} Z:${p.pos.z.toFixed(2)})`
        : `${p.username} (sem posição)`
      ).join(', ');
      logVisao(textoLog);
    }, 500);
  });

  bot.on('end', () => {
    console.log('🔁 Bot foi desconectado. Reiniciando...');
    setTimeout(criarBot, 500);
  });

  bot.on('error', (err) => {
    console.log(`❌ Erro: ${err.message}`);
    setTimeout(criarBot, 1000);
  });
}

server.listen(HTTP_PORT, () => {
  console.log(`🌐 Página online em http://localhost:${HTTP_PORT}`);
  criarBot();
});
