const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const PORT = 4444;
const BOT_SCRIPT = path.join(__dirname, '..', 'index.js');

let botProcess = null;
let startTime = null;
let recentLogs = [];

function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg.toString().trim()}`;
  recentLogs.push(line);
  if (recentLogs.length > 80) recentLogs.shift();
  console.log(line);
}

function startBot() {
  if (botProcess) return false;
  addLog('Starting MEXVERSE Discord Bot...');
  botProcess = spawn('node', [BOT_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  startTime = Date.now();

  botProcess.stdout.on('data', data => {
    addLog(data.toString());
  });

  botProcess.stderr.on('data', data => {
    addLog(`[ERROR] ${data.toString()}`);
  });

  botProcess.on('exit', (code, signal) => {
    addLog(`Bot process exited with code ${code || signal}`);
    botProcess = null;
    startTime = null;
  });

  return true;
}

function stopBot() {
  if (!botProcess) return false;
  addLog('Stopping MEXVERSE Discord Bot...');
  try {
    botProcess.kill();
  } catch (e) {
    console.error('Error killing process:', e);
  }
  botProcess = null;
  startTime = null;
  return true;
}

// Auto-start bot initially
startBot();

const server = http.createServer((req, res) => {
  const url = req.url;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (url === '/api/status') {
    const isRunning = botProcess !== null && !botProcess.killed;
    const uptimeSec = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const memUsage = Math.round(process.memoryUsage().rss / (1024 * 1024));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      running: isRunning,
      uptime: uptimeSec,
      memoryMB: memUsage,
      logs: recentLogs
    }));
    return;
  }

  if (url === '/api/toggle' && req.method === 'POST') {
    if (botProcess) {
      stopBot();
    } else {
      startBot();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: botProcess !== null }));
    return;
  }

  if (url === '/api/start' && req.method === 'POST') {
    startBot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, running: true }));
    return;
  }

  if (url === '/api/stop' && req.method === 'POST') {
    stopBot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, running: false }));
    return;
  }

  if (url === '/api/restart' && req.method === 'POST') {
    stopBot();
    setTimeout(() => {
      startBot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, running: true }));
    }, 1500);
    return;
  }

  // Serve Frontend UI
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MEXVERSE Bot Controller</title>
  <link rel="icon" href="https://mc-heads.net/avatar/MeXxz/64">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top, #131d2e 0%, #090d16 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 15px;
      user-select: none;
      -webkit-user-select: none;
    }
    .header {
      text-align: center;
      margin-bottom: 25px;
    }
    .badge-server {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 4px;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
    }

    /* CARD CONTAINER */
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      width: 100%;
      max-width: 480px;
      padding: 30px 20px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    /* MAIN GLOWING BUTTON */
    .power-btn {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      outline: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin: 15px 0 25px 0;
      position: relative;
    }
    .power-btn:active {
      transform: scale(0.94);
    }
    .power-btn svg {
      width: 52px;
      height: 52px;
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      margin-bottom: 6px;
    }
    .power-btn .btn-text {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    /* ONLINE STATE */
    .power-btn.online {
      background: radial-gradient(circle, #059669 0%, #047857 100%);
      color: #ffffff;
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.3);
    }
    .power-btn.online svg { stroke: #ffffff; }

    /* OFFLINE STATE */
    .power-btn.offline {
      background: radial-gradient(circle, #dc2626 0%, #991b1b 100%);
      color: #ffffff;
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.5), inset 0 0 15px rgba(255, 255, 255, 0.3);
    }
    .power-btn.offline svg { stroke: #ffffff; }

    /* STATUS PILL */
    .status-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .status-pill.online {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-pill.offline {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot.online { background: #10b981; box-shadow: 0 0 8px #10b981; }
    .dot.offline { background: #ef4444; box-shadow: 0 0 8px #ef4444; }

    /* STATS GRID */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
      margin-bottom: 20px;
    }
    .stat-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 12px 10px;
      text-align: center;
    }
    .stat-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .stat-val {
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
    }

    /* ACTION BUTTONS */
    .actions {
      display: flex;
      gap: 10px;
      width: 100%;
    }
    .btn-action {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-action:active { transform: scale(0.96); }
    .btn-restart {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .btn-restart:hover { background: rgba(59, 130, 246, 0.25); }

    /* TERMINAL LOGS */
    .terminal-container {
      width: 100%;
      max-width: 480px;
      margin-top: 15px;
      background: #050811;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
    }
    .terminal-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 8px 14px;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .terminal-body {
      height: 160px;
      overflow-y: auto;
      padding: 10px 12px;
      font-family: 'Consolas', monospace;
      font-size: 11px;
      color: #a5f3fc;
      line-height: 1.5;
      text-align: left;
    }
    .terminal-line { margin-bottom: 3px; word-break: break-all; }
  </style>
</head>
<body>

  <div class="header">
    <div class="badge-server">⚔️ MEXVERSE SMP</div>
    <h1>Bot One-Click Switch</h1>
    <div class="subtitle">Official Remote Control Panel</div>
  </div>

  <div class="card">
    <div id="statusPill" class="status-pill online">
      <div id="statusDot" class="dot online"></div>
      <span id="statusText">CHECKING...</span>
    </div>

    <button id="powerBtn" class="power-btn online" onclick="toggleBot()">
      <svg viewBox="0 0 24 24">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
        <line x1="12" y1="2" x2="12" y2="12"></line>
      </svg>
      <span id="btnLabel" class="btn-text">RUNNING</span>
    </button>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">RAM Usage</div>
        <div id="ramVal" class="stat-val">~45 MB</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Active Uptime</div>
        <div id="uptimeVal" class="stat-val">00:00:00</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-action btn-restart" onclick="restartBot()">
        🔄 Restart Bot
      </button>
    </div>
  </div>

  <div class="terminal-container">
    <div class="terminal-header">
      <span>LIVE BOT CONSOLE LOGS</span>
      <span id="logCount">Streaming</span>
    </div>
    <div id="terminalBody" class="terminal-body">
      <div class="terminal-line">[SYSTEM] Initializing Bot Dashboard...</div>
    </div>
  </div>

  <script>
    let isToggling = false;

    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const btn = document.getElementById('powerBtn');
        const btnLabel = document.getElementById('btnLabel');
        const pill = document.getElementById('statusPill');
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        const ram = document.getElementById('ramVal');
        const uptime = document.getElementById('uptimeVal');
        const term = document.getElementById('terminalBody');

        if (data.running) {
          btn.className = 'power-btn online';
          btnLabel.textContent = 'ONLINE';
          pill.className = 'status-pill online';
          dot.className = 'dot online';
          text.textContent = 'BOT IS RUNNING (TAP TO STOP)';
        } else {
          btn.className = 'power-btn offline';
          btnLabel.textContent = 'OFFLINE';
          pill.className = 'status-pill offline';
          dot.className = 'dot offline';
          text.textContent = 'BOT IS STOPPED (TAP TO START)';
        }

        ram.textContent = data.memoryMB + ' MB';

        // Format uptime
        const s = data.uptime;
        const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
        const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const secs = (s % 60).toString().padStart(2, '0');
        uptime.textContent = data.running ? (hrs + ':' + mins + ':' + secs) : '00:00:00';

        // Render logs
        if (data.logs && data.logs.length > 0) {
          term.innerHTML = data.logs.map(l => '<div class="terminal-line">' + l + '</div>').join('');
          term.scrollTop = term.scrollHeight;
        }
      } catch (err) {
        document.getElementById('statusText').textContent = 'CONNECTION ERROR';
      }
    }

    async function toggleBot() {
      if (isToggling) return;
      isToggling = true;
      document.getElementById('statusText').textContent = 'SWITCHING...';
      try {
        await fetch('/api/toggle', { method: 'POST' });
        await updateStatus();
      } catch (e) {}
      setTimeout(() => { isToggling = false; }, 800);
    }

    async function restartBot() {
      document.getElementById('statusText').textContent = 'RESTARTING...';
      try {
        await fetch('/api/restart', { method: 'POST' });
        setTimeout(updateStatus, 1600);
      } catch (e) {}
    }

    // Refresh every 2 seconds
    setInterval(updateStatus, 2000);
    updateStatus();
  </script>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOT CONTROLLER] Running live at:`);
  console.log(`• Local:   http://localhost:${PORT}`);
  console.log(`• Network: http://172.16.118.138:${PORT}`);
});
