const mineflayer = require('mineflayer');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const HTTP_PORT = 8080;
const LOG_PATH = path.resolve(__dirname, 'bot_vision.log');

let clientes = [];

// Função para escrever no log
function logVisao(texto) {
  const dataHora = new Date().toISOString();
  const linha = `[${dataHora}] ${texto}\n`;
  fs.appendFile(LOG_PATH, linha, (err) => {
    if (err) console.error('Erro ao escrever no log:', err);
  });
}

// Servidor HTTP para servir a página web
const htmlPagina = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Visão do LevyBot</title>
<style>
  body { background: #111; color: #0f0; font-family: monospace; padding: 20px; }
  h1 { text-align: center; }
</style>
</head>
<body>
  <h1>Visão do LevyBot</h1>
  <p><strong>Posição do bot:</strong> <span id="pos">Aguardando...</span></p>
  <p><strong>Jogadores visíveis:</strong></p>
  <ul id="players"></ul>

  <script>
    const ws = new WebSocket('ws://' + location.host);
    ws.onopen = () => console.log('Conectado ao bot');
    ws.onclose = () => {
      console.log('Conexão perdida');
      document.getElementById('pos').textContent = 'Desconectado';
      document.getElementById('players').innerHTML = '';
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      const pos = data.position;
      const players = data.players;

      document.getElementById('pos').textContent =
        \`X: \${pos.x.toFixed(2)}, Y: \${pos.y.toFixed(2)}, Z: \${pos.z.toFixed(2)}\`;

      const playersUl = document.getElementById('players');
      playersUl.innerHTML = '';
      players.forEach(p => {
        const li = document.createElement('li');
        if(p.pos) {
          li.textContent = \`\${p.username} — X: \${p.pos.x.toFixed(2)}, Y: \${p.pos.y.toFixed(2)}, Z: \${p.pos.z.toFixed(2)}\`;
        } else {
          li.textContent = \`\${p.username} — sem posição\`;
        }
        playersUl.appendChild(li);
      });
    };
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  // Serve só a página HTML na raiz
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
  console.log('Cliente conectado na página web');

  ws.on('close', () => {
    clientes = clientes.filter(c => c !== ws);
    console.log('Cliente desconectado');
  });
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
  return LevyBot[*_*]#${numero}`;
}

function criarBot() {
  const nome = gerarNomeAleatorio();
  console.log(`Tentando entrar como: ${nome}`);

  const bot = mineflayer.createBot({
    host: 'Speedfire1237.aternos.me', // troca aqui
    port: 36424,
    username: nome,
  });

  bot.on('spawn', () => {
    console.log(`Bot conectado como ${bot.username}`);

    setInterval(() => {
      if (!bot.entity) return;

      const pos = bot.entity.position;
      const players = Object.values(bot.players).map(p => ({
        username: p.username,
        pos: p.entity ? p.entity.position : null,
      }));

      const data = {
        position: { x: pos.x, y: pos.y, z: pos.z },
        players,
      };

      broadcast(data);

      let textoLog = `Posição do bot: X:${pos.x.toFixed(2)} Y:${pos.y.toFixed(2)} Z:${pos.z.toFixed(2)} | Jogadores: `;
      textoLog += players.map(p => p.pos
        ? `${p.username} (X:${p.pos.x.toFixed(2)} Y:${p.pos.y.toFixed(2)} Z:${p.pos.z.toFixed(2)})`
        : `${p.username} (sem posição)`
      ).join(', ');

      logVisao(textoLog);
    }, 500);
  });

  bot.on('end', () => {
    console.log('Bot desconectado. Tentando outro nome...');
    setTimeout(criarBot, 100);
  });

  bot.on('error', (err) => {
    console.log(`Erro: ${err.message}`);
    setTimeout(criarBot, 100);
  });
}

server.listen(HTTP_PORT, () => {
  console.log(`Servidor HTTP rodando na porta ${HTTP_PORT}`);
  criarBot();
});
