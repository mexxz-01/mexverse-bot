const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Load environment variables
const ENV_PATH = path.join(__dirname, '..', '.env');
try {
  if (process.loadEnvFile) {
    process.loadEnvFile(ENV_PATH);
  } else if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const l of lines) {
      const match = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) process.env[match[1]] = (match[2] || '').trim();
    }
  }
} catch (e) {}

const PORT = 4444;
const BOT_SCRIPT = path.join(__dirname, '..', 'index.js');
const DATA_DIR = path.join(__dirname, '..', 'data');
const MC_LOG_PATH = path.join('C:', 'smp', 'logs', 'latest.log');
const ANNOUNCEMENTS_CHAN_ID = '1570430999127523361';

let botProcess = null;
let startTime = null;
let recentLogs = [];

function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg.toString().trim()}`;
  recentLogs.push(line);
  if (recentLogs.length > 200) recentLogs.shift();
  console.log(line);
}

function startBot() {
  if (botProcess) return false;
  addLog('Starting MEXVERSE Discord Bot...');
  botProcess = spawn('node', [BOT_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '4445' }, // Avoid port collision with dashboard
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

// RCON Client Function
function executeRcon(cmd) {
  return new Promise((resolve) => {
    const client = net.createConnection({ port: 25575, host: '127.0.0.1' }, () => {
      sendPacket(1, 3, 'mexverseAdmin2026');
    });

    let authed = false;
    let timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, output: 'Connection timed out (Server may be offline or RCON disabled).' });
    }, 4000);

    function sendPacket(id, type, body) {
      const bodyBuf = Buffer.from(body, 'utf8');
      const len = 4 + 4 + bodyBuf.length + 2;
      const buf = Buffer.alloc(4 + len);
      buf.writeInt32LE(len, 0);
      buf.writeInt32LE(id, 4);
      buf.writeInt32LE(type, 8);
      bodyBuf.copy(buf, 12);
      buf.writeInt16LE(0, 12 + bodyBuf.length);
      client.write(buf);
    }

    client.on('data', data => {
      if (!authed) {
        authed = true;
        sendPacket(2, 2, cmd);
      } else {
        clearTimeout(timeout);
        const res = data.toString('utf8', 12, data.length - 2).replace(/§[0-9a-fk-or]/gi, '').trim();
        client.end();
        resolve({ success: true, output: res || 'Command executed successfully.' });
      }
    });

    client.on('error', err => {
      clearTimeout(timeout);
      resolve({ success: false, output: `RCON Connection Error: ${err.message}` });
    });
  });
}

// Read JSON Data Helper
function readJson(filename, defVal = {}) {
  try {
    const p = path.join(DATA_DIR, filename);
    if (!fs.existsSync(p)) return defVal;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return defVal;
  }
}

function writeJson(filename, data) {
  try {
    const p = path.join(DATA_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

// Parse Combat / Log Feed
function getRecentEvents() {
  if (!fs.existsSync(MC_LOG_PATH)) return [];
  try {
    const content = fs.readFileSync(MC_LOG_PATH, 'utf8');
    const lines = content.split('\n').slice(-300);
    const events = [];

    const deathKeywords = [
      'was slain by', 'was killed by', 'fell from a high place', 'fell out of the world',
      'hit the ground too hard', 'was blown up by', 'was shot by', 'burned to death',
      'tried to swim in lava', 'drowned', 'suffocated in a wall', 'starved to death'
    ];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.includes('[Server thread/INFO]: ')) continue;
      const text = line.substring(line.indexOf('[Server thread/INFO]: ') + 22).trim();

      // Advancements
      const advMatch = text.match(/^([a-zA-Z0-9_.*]+)\s+has\s+(made the advancement|completed the challenge|reached the goal)\s+\[(.+?)\]/);
      if (advMatch) {
        events.push({
          type: 'advancement',
          player: advMatch[1],
          detail: advMatch[3],
          raw: text,
          time: line.substring(1, 9)
        });
        continue;
      }

      // Deaths
      if (deathKeywords.some(k => text.includes(k)) && !text.includes(':') && !text.startsWith('[')) {
        events.push({
          type: 'death',
          player: text.split(' ')[0],
          detail: text,
          raw: text,
          time: line.substring(1, 9)
        });
      }
    }

    return events.reverse().slice(0, 30);
  } catch (e) {
    return [];
  }
}

// Auto-start bot initially
startBot();

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Helper for JSON response
  const sendJson = (data, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // Helper for POST body parser
  const getBody = () => new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { resolve({}); }
    });
  });

  // ================= API ENDPOINTS =================
  if (pathname === '/api/status') {
    const isRunning = botProcess !== null && !botProcess.killed;
    const uptimeSec = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const memUsage = Math.round(process.memoryUsage().rss / (1024 * 1024));

    const eco = readJson('economy.json', {});
    const bounties = readJson('bounties.json', {});
    const linked = readJson('linked.json', {});
    const playtime = readJson('playtime.json', {});

    let totalCoins = 0;
    Object.values(eco).forEach(u => totalCoins += (u.coins || 0));

    // Live Minecraft Server Players via RCON
    let onlinePlayers = [];
    try {
      const listRes = await executeRcon('list');
      if (listRes.success && listRes.output) {
        const parts = listRes.output.split(':');
        if (parts.length > 1) {
          onlinePlayers = parts[1].split(',').map(s => s.trim()).filter(Boolean);
        }
      }
    } catch (e) {}

    // System stats
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);

    return sendJson({
      running: isRunning,
      uptime: uptimeSec,
      memoryMB: memUsage,
      minecraft: {
        online: true,
        playerCount: onlinePlayers.length,
        players: onlinePlayers
      },
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        totalRamGB: totalMem,
        freeRamGB: freeMem
      },
      stats: {
        totalCoins,
        linkedCount: Object.keys(linked).length,
        bountiesCount: Object.keys(bounties).length,
        playtimeCount: Object.keys(playtime).length
      },
      logs: recentLogs.slice(-100)
    });
  }

  if (pathname === '/api/toggle' && req.method === 'POST') {
    if (botProcess) stopBot();
    else startBot();
    return sendJson({ running: botProcess !== null });
  }

  if (pathname === '/api/restart' && req.method === 'POST') {
    stopBot();
    setTimeout(() => {
      startBot();
      sendJson({ success: true, running: true });
    }, 1200);
    return;
  }

  if (pathname === '/api/rcon' && req.method === 'POST') {
    const { cmd } = await getBody();
    if (!cmd) return sendJson({ success: false, output: 'No command provided.' }, 400);
    addLog(`[RCON DISPATCH] /${cmd}`);
    const result = await executeRcon(cmd);
    return sendJson(result);
  }

  if (pathname === '/api/realm-feed') {
    return sendJson({ events: getRecentEvents() });
  }

  if (pathname === '/api/bounties') {
    const bounties = readJson('bounties.json', {});
    return sendJson({ bounties: Object.values(bounties) });
  }

  if (pathname === '/api/economy') {
    const eco = readJson('economy.json', {});
    const linked = readJson('linked.json', {});
    const top = Object.entries(eco)
      .map(([id, data]) => ({
        id,
        coins: data.coins || 0,
        level: data.level || 1,
        xp: data.xp || 0,
        ign: linked[id]?.username || 'Not Linked'
      }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 15);

    return sendJson({ leaderboard: top });
  }

  if (pathname === '/api/give-coins' && req.method === 'POST') {
    const { userId, amount } = await getBody();
    if (!userId || !amount) return sendJson({ success: false, message: 'Invalid params' }, 400);
    const eco = readJson('economy.json', {});
    if (!eco[userId]) {
      eco[userId] = { coins: 100, xp: 0, level: 1, lastDaily: 0, lastMessage: 0, inventory: [] };
    }
    eco[userId].coins += parseInt(amount, 10);
    writeJson('economy.json', eco);
    addLog(`[TREASURY GRANT] Awarded ${amount} MexCoins to User ID: ${userId}`);
    return sendJson({ success: true, newBalance: eco[userId].coins });
  }

  if (pathname === '/api/key-drop' && req.method === 'POST') {
    const { crate, amount } = await getBody();
    const crateType = crate || 'prime_crate';
    const num = amount || 1;
    const result = await executeRcon(`crate keyall ${crateType} ${num}`);
    addLog(`[KEY DROP] Server-wide drop x${num} ${crateType}`);
    return sendJson(result);
  }

  if (pathname === '/api/broadcast' && req.method === 'POST') {
    const { title, message } = await getBody();
    if (!title || !message) return sendJson({ success: false, message: 'Missing title or message' }, 400);
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${ANNOUNCEMENTS_CHAN_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embeds: [{
            title: `📢 ${title}`,
            description: message,
            color: 0x10B981,
            footer: { text: 'MEXVERSE SMP • Official Dashboard Broadcast' },
            timestamp: new Date().toISOString()
          }]
        })
      });
      const data = await res.json();
      addLog(`[DISCORD BROADCAST] "${title}" posted to announcements`);
      return sendJson({ success: true, messageId: data.id });
    } catch (err) {
      return sendJson({ success: false, error: err.message }, 500);
    }
  }

  // ================= MODERN DASHBOARD UI =================
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>MEXVERSE SMP • Operations Command Center</title>
  <link rel="icon" href="https://mc-heads.net/avatar/MeXxz/64">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #060911;
      --bg-card: rgba(15, 23, 42, 0.75);
      --bg-card-hover: rgba(30, 41, 59, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-glow: rgba(16, 185, 129, 0.35);
      --accent-emerald: #10b981;
      --accent-emerald-glow: rgba(16, 185, 129, 0.25);
      --accent-amber: #f59e0b;
      --accent-blue: #3b82f6;
      --accent-purple: #8b5cf6;
      --accent-red: #ef4444;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background: radial-gradient(circle at 50% -20%, #172554 0%, #060911 65%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* TOP NAVIGATION BAR */
    .navbar {
      height: 70px;
      background: rgba(6, 9, 17, 0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent-emerald);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .nav-center {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(15, 23, 42, 0.6);
      padding: 5px;
      border-radius: 14px;
      border: 1px solid var(--border-subtle);
    }
    .nav-tab {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 7px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .nav-tab:hover { color: #fff; background: rgba(255, 255, 255, 0.04); }
    .nav-tab.active {
      color: #fff;
      background: rgba(16, 185, 129, 0.18);
      border: 1px solid rgba(16, 185, 129, 0.35);
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ip-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid var(--border-subtle);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .ip-badge:hover {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: var(--accent-emerald);
    }

    /* MAIN CONTENT WRAPPER */
    .container {
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 24px;
      flex: 1;
    }

    /* TAB CONTENT PANES */
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.3s ease; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* BENTO GRID */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 20px;
    }

    .card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.7);
    }
    .card-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* SPECIFIC CARDS */
    .card-power {
      grid-column: span 4;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 24px;
    }
    .card-stats { grid-column: span 8; }
    .card-terminal { grid-column: span 12; }
    .card-half { grid-column: span 6; }

    /* BIG POWER SWITCH */
    .power-btn {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: none;
      outline: none;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 12px 0 20px 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }
    .power-btn:active { transform: scale(0.93); }
    .power-btn svg {
      width: 46px;
      height: 46px;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      margin-bottom: 4px;
    }
    .power-btn.online {
      background: radial-gradient(circle, #059669 0%, #047857 100%);
      color: #fff;
      box-shadow: 0 0 45px rgba(16, 185, 129, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.25);
    }
    .power-btn.online svg { stroke: #fff; }
    .power-btn.offline {
      background: radial-gradient(circle, #dc2626 0%, #991b1b 100%);
      color: #fff;
      box-shadow: 0 0 40px rgba(239, 68, 68, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.2);
    }
    .power-btn.offline svg { stroke: #fff; }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
    }
    .status-pill.online {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: var(--accent-emerald);
    }
    .status-pill.offline {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: var(--accent-red);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .pulse-dot.online { background: #10b981; box-shadow: 0 0 10px #10b981; }
    .pulse-dot.offline { background: #ef4444; box-shadow: 0 0 10px #ef4444; }

    /* STAT TILES */
    .stat-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-tile {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 16px;
      position: relative;
    }
    .stat-tile-val {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #fff;
      margin-top: 4px;
    }
    .stat-tile-desc {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ACTION BUTTONS */
    .btn {
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn:active { transform: scale(0.96); }
    .btn-emerald {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #fff;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
    }
    .btn-emerald:hover { box-shadow: 0 0 30px rgba(16, 185, 129, 0.5); }
    .btn-restart {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
    }
    .btn-restart:hover { background: rgba(59, 130, 246, 0.25); }

    /* RCON CONSOLE */
    .console-box {
      background: #040711;
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      overflow: hidden;
    }
    .console-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .console-output {
      height: 380px;
      overflow-y: auto;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
      color: #a5f3fc;
    }
    .console-input-bar {
      display: flex;
      padding: 12px;
      background: rgba(15, 23, 42, 0.8);
      border-top: 1px solid var(--border-subtle);
      gap: 10px;
    }
    .console-input {
      flex: 1;
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px 16px;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      outline: none;
    }
    .console-input:focus { border-color: var(--accent-emerald); }

    .quick-chips {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    .chip:hover {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-emerald);
      border-color: rgba(16, 185, 129, 0.3);
    }

    /* REALM COMBAT FEED LIST */
    .feed-list {
      max-height: 480px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .feed-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
    }
    .feed-item.death { border-left: 3px solid var(--accent-red); }
    .feed-item.advancement { border-left: 3px solid var(--accent-amber); }
    .feed-avatar {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #0f172a;
    }
    .feed-content { flex: 1; }
    .feed-title { font-size: 13px; font-weight: 700; color: #fff; }
    .feed-time { font-size: 11px; color: var(--text-dim); }

    /* TOAST NOTIFICATION */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      border: 1px solid var(--accent-emerald);
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }

    /* RESPONSIVE */
    @media (max-width: 900px) {
      .navbar { padding: 0 16px; }
      .nav-center { display: none; }
      .card-power { grid-column: span 12; }
      .card-stats { grid-column: span 12; }
      .card-half { grid-column: span 12; }
      .stat-row { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

  <!-- TOP NAVBAR -->
  <nav class="navbar">
    <a href="#" class="brand">
      <div class="brand-icon">⚔️</div>
      <div>
        <div class="brand-title">MEXVERSE SMP</div>
        <div class="brand-sub">Operations Command</div>
      </div>
    </a>

    <div class="nav-center">
      <button class="nav-tab active" onclick="switchTab('overview')">📊 Overview</button>
      <button class="nav-tab" onclick="switchTab('rcon')">💻 Live Console</button>
      <button class="nav-tab" onclick="switchTab('feed')">⚔️ Combat Feed</button>
      <button class="nav-tab" onclick="switchTab('admin')">🎁 Admin Toolbox</button>
      <button class="nav-tab" onclick="switchTab('logs')">📜 Bot Logs</button>
    </div>

    <div class="nav-actions">
      <div class="ip-badge" onclick="copyIp('mexverse.qd.je')">
        <span>🖥️ mexverse.qd.je</span>
        <span style="color:var(--text-dim);font-size:10px;">COPY</span>
      </div>
      <div class="ip-badge" onclick="copyIp('impairment-insider.tun.ply.gg:22938')">
        <span>📱 Port 22938</span>
        <span style="color:var(--text-dim);font-size:10px;">COPY</span>
      </div>
    </div>
  </nav>

  <div class="container">

    <!-- TAB 1: OVERVIEW -->
    <div id="tab-overview" class="tab-pane active">
      <div class="bento-grid">

        <!-- POWER SWITCH CARD -->
        <div class="card card-power">
          <div id="statusPill" class="status-pill online">
            <div id="statusDot" class="pulse-dot online"></div>
            <span id="statusText">CHECKING...</span>
          </div>

          <button id="powerBtn" class="power-btn online" onclick="toggleBot()">
            <svg viewBox="0 0 24 24">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
            <span id="btnLabel" style="font-size:13px; font-weight:800; letter-spacing:0.8px;">ONLINE</span>
          </button>

          <div style="font-size:12px; color:var(--text-dim); margin-bottom:16px;">
            Tap switch to immediately pause or resume bot gateway stream.
          </div>

          <button class="btn btn-restart" onclick="restartBot()">
            🔄 Restart Bot Process
          </button>
        </div>

        <!-- TELEMETRY & SYSTEM HEALTH -->
        <div class="card card-stats">
          <div class="card-title">
            <span>⚡ REAL-TIME SYSTEM & REALM TELEMETRY</span>
            <span style="color:var(--accent-emerald); font-size:12px;">● LIVE 2.0s</span>
          </div>

          <div class="stat-row">
            <div class="stat-tile">
              <div class="stat-tile-desc">Bot Uptime</div>
              <div id="uptimeVal" class="stat-tile-val">00:00:00</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-desc">Node.js RSS RAM</div>
              <div id="ramVal" class="stat-tile-val">~45 MB</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-desc">Registered Players</div>
              <div id="linkedCount" class="stat-tile-val">0</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-desc">Economy Pool</div>
              <div id="coinsVal" class="stat-tile-val" style="color:var(--accent-amber);">0</div>
            </div>
          </div>

          <div class="stat-row" style="margin-bottom:0;">
            <div class="stat-tile">
              <div class="stat-tile-desc">Warriors In-Game</div>
              <div id="onlinePlayersCount" class="stat-tile-val" style="font-size:18px; color:var(--accent-emerald);">0 Online</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-desc">Available RAM</div>
              <div id="freeRam" class="stat-tile-val" style="font-size:18px;">~8.0 GB</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-desc">Active Bounties</div>
              <div id="bountiesCount" class="stat-tile-val" style="font-size:18px; color:var(--accent-red);">0</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-desc">Server Engine</div>
              <div class="stat-tile-val" style="font-size:16px; color:#38bdf8;">Purpur 1.21.11</div>
            </div>
          </div>
        </div>

        <!-- ONLINE WARRIORS LIVE LIST -->
        <div class="card card-terminal" style="margin-bottom: -10px;">
          <div class="card-title">
            <span>👥 CURRENTLY CONNECTED IN-GAME WARRIORS</span>
            <span id="playerBadge" style="color:var(--accent-emerald); font-size:12px; font-weight:700;">Live</span>
          </div>
          <div id="onlinePlayersList" style="display:flex; gap:12px; flex-wrap:wrap; min-height:45px; align-items:center;">
            <div style="color:var(--text-dim); font-size:13px;">Checking server player list...</div>
          </div>
        </div>

        <!-- QUICK TERMINAL PREVIEW -->
        <div class="card card-terminal">
          <div class="card-title">
            <span>📟 LIVE BOT GATEWAY STREAM</span>
            <button class="btn btn-restart" style="padding:4px 10px; font-size:11px;" onclick="clearLogs()">Clear</button>
          </div>
          <div class="console-box">
            <div id="miniTerminal" class="console-output" style="height:180px;">
              [SYSTEM] Streaming live output from Discord bot...
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- TAB 2: IN-GAME RCON CONSOLE -->
    <div id="tab-rcon" class="tab-pane">
      <div class="card" style="padding:20px;">
        <div class="card-title">
          <span>💻 MINECRAFT SERVER RCON TERMINAL (DIRECT PURPUR CONSOLE)</span>
          <span style="color:#38bdf8;">PORT: 25575 • AUTHENTICATED</span>
        </div>

        <div class="console-box">
          <div class="console-header">
            <span>CONSOLE OUTPUT (ANSI DECODED)</span>
            <span id="rconStatus">Ready for input</span>
          </div>
          <div id="rconOutput" class="console-output">
[RCON] MEXVERSE SMP Server Console Connected.
Type any Minecraft command below and press Enter (e.g. 'list', 'tps', 'say Hello Warriors!').
          </div>
          <div class="console-input-bar">
            <input id="rconInput" class="console-input" type="text" placeholder="Type command without '/' (e.g. list, tps, time set day)..." onkeydown="handleRconKey(event)">
            <button class="btn btn-emerald" onclick="submitRcon()">Execute ↵</button>
          </div>
        </div>

        <div class="quick-chips">
          <span style="font-size:12px; font-weight:700; color:var(--text-muted); align-self:center;">Quick Macros:</span>
          <div class="chip" onclick="quickRcon('list')">list</div>
          <div class="chip" onclick="quickRcon('tps')">tps</div>
          <div class="chip" onclick="quickRcon('weather clear')">weather clear</div>
          <div class="chip" onclick="quickRcon('time set day')">time set day</div>
          <div class="chip" onclick="quickRcon('save-all')">save-all</div>
          <div class="chip" onclick="quickRcon('crate list')">crate list</div>
        </div>
      </div>
    </div>

    <!-- TAB 3: REALM COMBAT FEED -->
    <div id="tab-feed" class="tab-pane">
      <div class="bento-grid">
        <div class="card card-half">
          <div class="card-title">
            <span>⚔️ LIVE REALM CASUALTY & COMBAT FEED</span>
            <button class="btn btn-restart" style="padding:4px 10px; font-size:11px;" onclick="loadFeed()">Refresh</button>
          </div>
          <div id="feedList" class="feed-list">
            <div style="color:var(--text-dim); text-align:center; padding:30px;">Loading combat telemetry...</div>
          </div>
        </div>

        <div class="card card-half">
          <div class="card-title">
            <span>🎯 ACTIVE PVP BOUNTY HITLIST</span>
            <span style="color:var(--accent-amber);">PRIZE POOL</span>
          </div>
          <div id="bountyList" class="feed-list">
            <div style="color:var(--text-dim); text-align:center; padding:30px;">No active bounties on the realm.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: ADMIN TOOLBOX -->
    <div id="tab-admin" class="tab-pane">
      <div class="bento-grid">

        <!-- DISCORD BROADCAST TOOL -->
        <div class="card card-terminal">
          <div class="card-title">
            <span>📢 DISCORD OFFICIAL ANNOUNCEMENTS BROADCASTER</span>
            <span style="color:var(--accent-emerald);">TARGET: #📢┃announcements</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <input id="broadcastTitle" class="console-input" type="text" placeholder="Announcement Headline (e.g. Weekend PvP Tournament / Server Maintenance)...">
            <textarea id="broadcastMessage" class="console-input" style="height:90px; resize:vertical;" placeholder="Write full announcement content here..."></textarea>
            <button class="btn btn-emerald" style="align-self:flex-start;" onclick="executeBroadcast()">
              🚀 Publish to Discord Channel
            </button>
          </div>
        </div>

        <!-- KEY DROP TOOL -->
        <div class="card card-half">
          <div class="card-title">
            <span>🎁 SERVER-WIDE CRATE KEY DROP (KEYALL)</span>
          </div>
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            Instantly grant crate keys to every online warrior currently connected to MEXVERSE SMP.
          </div>
          <div style="display:flex; gap:12px; margin-bottom:16px;">
            <select id="dropCrate" class="console-input" style="flex:2;">
              <option value="prime_crate">🔥 Prime Crate (God Tier)</option>
              <option value="crimson_crate">🩸 Crimson Crate (Mythic Tier)</option>
              <option value="gold_crate">💰 Gold Crate (Epic Tier)</option>
              <option value="amethyst_crate">🔮 Amethyst Crate (Rare Tier)</option>
              <option value="common_crate">📦 Common Crate (Starter Tier)</option>
            </select>
            <input id="dropAmount" class="console-input" type="number" min="1" max="16" value="1" style="flex:1;">
          </div>
          <button class="btn btn-emerald" style="width:100%;" onclick="executeKeyDrop()">
            🚀 Drop Keys Server-Wide
          </button>
        </div>

        <!-- TREASURY GRANT -->
        <div class="card card-half">
          <div class="card-title">
            <span>🏛️ TREASURY GRANT (MINT MEXCOINS)</span>
          </div>
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            Directly credit MexCoins to any member's Discord balance from the official SMP treasury.
          </div>
          <div style="display:flex; gap:12px; margin-bottom:16px;">
            <input id="grantUser" class="console-input" type="text" placeholder="Discord User ID..." style="flex:2;">
            <input id="grantAmount" class="console-input" type="number" min="50" max="500000" placeholder="Coins..." style="flex:1;">
          </div>
          <button class="btn btn-emerald" style="width:100%;" onclick="executeCoinGrant()">
            💰 Grant Coins to Member
          </button>
        </div>

        <!-- ECONOMY LEADERBOARD -->
        <div class="card card-terminal">
          <div class="card-title">
            <span>🏆 OFFICIAL REALM WEALTH LEADERBOARD (TOP 15 CITIZENS)</span>
            <button class="btn btn-restart" style="padding:4px 10px; font-size:11px;" onclick="loadLeaderboard()">Refresh</button>
          </div>
          <div id="leaderboardList" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
            <div style="color:var(--text-dim); padding:20px;">Loading leaderboard...</div>
          </div>
        </div>

      </div>
    </div>

    <!-- TAB 5: BOT LOGS -->
    <div id="tab-logs" class="tab-pane">
      <div class="card">
        <div class="card-title">
          <span>📜 DISCORD BOT TERMINAL STREAM (FULL BUFFER)</span>
          <button class="btn btn-restart" style="padding:4px 10px; font-size:11px;" onclick="clearLogs()">Clear Screen</button>
        </div>
        <div class="console-box">
          <div id="fullTerminal" class="console-output" style="height:500px;">
            [SYSTEM] Loading buffer...
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- TOAST POPUP -->
  <div id="toast" class="toast">Action completed!</div>

  <script>
    let isToggling = false;

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2800);
    }

    function copyIp(text) {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard: ' + text);
    }

    function switchTab(tabId) {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      const targetBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick')?.includes(tabId));
      if (targetBtn) targetBtn.classList.add('active');

      const targetPane = document.getElementById('tab-' + tabId);
      if (targetPane) targetPane.classList.add('active');

      if (tabId === 'feed') { loadFeed(); loadBounties(); }
      if (tabId === 'admin') { loadLeaderboard(); }
    }

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
        const coins = document.getElementById('coinsVal');
        const linked = document.getElementById('linkedCount');
        const freeRam = document.getElementById('freeRam');
        const hostPlatform = document.getElementById('hostPlatform');
        const bountiesCount = document.getElementById('bountiesCount');
        const onlineCount = document.getElementById('onlinePlayersCount');
        const onlineList = document.getElementById('onlinePlayersList');
        const miniTerm = document.getElementById('miniTerminal');
        const fullTerm = document.getElementById('fullTerminal');

        if (data.running) {
          btn.className = 'power-btn online';
          btnLabel.textContent = 'ONLINE';
          pill.className = 'status-pill online';
          dot.className = 'pulse-dot online';
          text.textContent = 'BOT RUNNING (TAP TO STOP)';
        } else {
          btn.className = 'power-btn offline';
          btnLabel.textContent = 'OFFLINE';
          pill.className = 'status-pill offline';
          dot.className = 'pulse-dot offline';
          text.textContent = 'BOT STOPPED (TAP TO START)';
        }

        ram.textContent = data.memoryMB + ' MB';
        coins.textContent = (data.stats.totalCoins || 0).toLocaleString();
        linked.textContent = (data.stats.linkedCount || 0).toLocaleString();
        bountiesCount.textContent = data.stats.bountiesCount || 0;
        hostPlatform.textContent = (data.system.platform || 'win32').toUpperCase();
        freeRam.textContent = data.system.freeRamGB + ' GB';

        // Render In-Game Players
        if (data.minecraft && data.minecraft.players) {
          const count = data.minecraft.players.length;
          onlineCount.textContent = count + ' Online';
          if (count === 0) {
            onlineList.innerHTML = '<div style="color:var(--text-dim); font-size:13px; font-style:italic;">No warriors currently in the realm.</div>';
          } else {
            onlineList.innerHTML = data.minecraft.players.map(p => {
              const avatar = 'https://mc-heads.net/avatar/' + encodeURIComponent(p) + '/28';
              return '<div style="display:inline-flex; align-items:center; gap:8px; background:rgba(30,41,59,0.7); border:1px solid var(--border-subtle); padding:6px 12px; border-radius:10px;">' +
                '<img src="' + avatar + '" style="width:24px;height:24px;border-radius:4px;" onerror="this.src=\\'https://mc-heads.net/avatar/MHF_Steve/28\\'">' +
                '<span style="font-size:13px;font-weight:700;color:#fff;">' + escapeHtml(p) + '</span>' +
                '<span style="font-size:11px;color:var(--accent-red);cursor:pointer;margin-left:4px;" onclick="quickRcon(\\'kick ' + escapeHtml(p) + ' Server restart\\')">✕</span>' +
              '</div>';
            }).join('');
          }
        }

        // Format uptime
        const s = data.uptime;
        const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
        const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const secs = (s % 60).toString().padStart(2, '0');
        uptime.textContent = data.running ? (hrs + ':' + mins + ':' + secs) : '00:00:00';

        // Render logs
        if (data.logs && data.logs.length > 0) {
          const logHtml = data.logs.map(l => '<div style="margin-bottom:2px;">' + escapeHtml(l) + '</div>').join('');
          miniTerm.innerHTML = logHtml;
          miniTerm.scrollTop = miniTerm.scrollHeight;

          if (fullTerm) {
            fullTerm.innerHTML = logHtml;
            fullTerm.scrollTop = fullTerm.scrollHeight;
          }
        }
      } catch (err) {}
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function clearLogs() {
      document.getElementById('miniTerminal').innerHTML = '<div style="color:var(--text-dim);">Logs cleared from view.</div>';
      document.getElementById('fullTerminal').innerHTML = '<div style="color:var(--text-dim);">Logs cleared from view.</div>';
      showToast('Log view cleared');
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
      showToast('Restarting Discord bot...');
      try {
        await fetch('/api/restart', { method: 'POST' });
        setTimeout(updateStatus, 1500);
      } catch (e) {}
    }

    // RCON Execution
    async function submitRcon() {
      const input = document.getElementById('rconInput');
      const cmd = input.value.trim();
      if (!cmd) return;
      input.value = '';

      const term = document.getElementById('rconOutput');
      term.innerHTML += '<div style="color:#38bdf8; margin-top:6px;">> ' + escapeHtml(cmd) + '</div>';

      try {
        const res = await fetch('/api/rcon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd })
        });
        const data = await res.json();
        term.innerHTML += '<div style="color:#a5f3fc;">' + escapeHtml(data.output || 'No output') + '</div>';
        term.scrollTop = term.scrollHeight;
      } catch (e) {
        term.innerHTML += '<div style="color:#ef4444;">[ERROR] Failed to send RCON packet</div>';
      }
    }

    function handleRconKey(e) {
      if (e.key === 'Enter') submitRcon();
    }

    function quickRcon(cmd) {
      document.getElementById('rconInput').value = cmd;
      submitRcon();
    }

    // Load Feed
    async function loadFeed() {
      const feed = document.getElementById('feedList');
      try {
        const res = await fetch('/api/realm-feed');
        const data = await res.json();
        if (!data.events || data.events.length === 0) {
          feed.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:30px;">No recent combat events logged.</div>';
          return;
        }

        feed.innerHTML = data.events.map(ev => {
          const isDeath = ev.type === 'death';
          const icon = isDeath ? '💀' : '🏆';
          const avatar = 'https://mc-heads.net/avatar/' + encodeURIComponent(ev.player) + '/38';
          return '<div class="feed-item ' + ev.type + '">' +
            '<img class="feed-avatar" src="' + avatar + '" alt="' + ev.player + '" onerror="this.src=\\'https://mc-heads.net/avatar/MHF_Steve/38\\'">' +
            '<div class="feed-content">' +
              '<div class="feed-title">' + icon + ' ' + escapeHtml(ev.detail) + '</div>' +
              '<div class="feed-time">At ' + ev.time + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      } catch (e) {
        feed.innerHTML = '<div style="color:var(--accent-red); padding:20px;">Failed to fetch feed.</div>';
      }
    }

    // Load Bounties
    async function loadBounties() {
      const el = document.getElementById('bountyList');
      try {
        const res = await fetch('/api/bounties');
        const data = await res.json();
        if (!data.bounties || data.bounties.length === 0) {
          el.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:30px;">No active wanted targets on the realm.</div>';
          return;
        }

        el.innerHTML = data.bounties.map(b => {
          const avatar = 'https://mc-heads.net/avatar/' + encodeURIComponent(b.target) + '/38';
          return '<div class="feed-item" style="border-left:3px solid var(--accent-red);">' +
            '<img class="feed-avatar" src="' + avatar + '" alt="' + b.target + '">' +
            '<div class="feed-content">' +
              '<div class="feed-title">🎯 TARGET: ' + escapeHtml(b.target) + '</div>' +
              '<div style="font-size:12px; color:var(--accent-amber); font-weight:700;">💰 ' + b.amount.toLocaleString() + ' MexCoins</div>' +
            '</div>' +
          '</div>';
        }).join('');
      } catch (e) {}
    }

    // Load Leaderboard
    async function loadLeaderboard() {
      const el = document.getElementById('leaderboardList');
      try {
        const res = await fetch('/api/economy');
        const data = await res.json();
        if (!data.leaderboard || data.leaderboard.length === 0) {
          el.innerHTML = '<div style="color:var(--text-dim); padding:20px;">No citizen records found.</div>';
          return;
        }

        el.innerHTML = data.leaderboard.map((u, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
          return '<div class="stat-tile" style="display:flex; align-items:center; gap:12px;">' +
            '<div style="font-size:18px; font-weight:800; min-width:30px;">' + medal + '</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:13px; font-weight:700; color:#fff;">' + escapeHtml(u.ign) + '</div>' +
              '<div style="font-size:11px; color:var(--text-dim);">Level ' + u.level + ' • ' + u.xp.toLocaleString() + ' XP</div>' +
            '</div>' +
            '<div style="font-size:14px; font-weight:800; color:var(--accent-amber);">' + u.coins.toLocaleString() + ' 🪙</div>' +
          '</div>';
        }).join('');
      } catch (e) {}
    }

    // Admin Key Drop
    async function executeKeyDrop() {
      const crate = document.getElementById('dropCrate').value;
      const amount = parseInt(document.getElementById('dropAmount').value, 10) || 1;
      showToast('Dispatching server-wide key drop...');
      try {
        const res = await fetch('/api/key-drop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crate, amount })
        });
        const data = await res.json();
        showToast(data.output || 'Keys dropped successfully!');
      } catch (e) {
        showToast('Error dropping keys');
      }
    }

    // Admin Coin Grant
    async function executeCoinGrant() {
      const userId = document.getElementById('grantUser').value.trim();
      const amount = parseInt(document.getElementById('grantAmount').value, 10);
      if (!userId || !amount) {
        showToast('Please enter both User ID and Amount');
        return;
      }
      try {
        const res = await fetch('/api/give-coins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Granted ' + amount.toLocaleString() + ' coins to User!');
          document.getElementById('grantUser').value = '';
          document.getElementById('grantAmount').value = '';
          updateStatus();
        } else {
          showToast('Failed to grant coins');
        }
      } catch (e) {
        showToast('Connection error');
      }
    }

    // Discord Announcement Broadcast
    async function executeBroadcast() {
      const title = document.getElementById('broadcastTitle').value.trim();
      const message = document.getElementById('broadcastMessage').value.trim();
      if (!title || !message) {
        showToast('Please provide both headline and message');
        return;
      }
      showToast('Sending broadcast to #announcements...');
      try {
        const res = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, message })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✅ Announcement published to Discord!');
          document.getElementById('broadcastTitle').value = '';
          document.getElementById('broadcastMessage').value = '';
        } else {
          showToast('Failed to post announcement: ' + (data.error || 'error'));
        }
      } catch (e) {
        showToast('Broadcast connection error');
      }
    }

    setInterval(updateStatus, 2000);
    updateStatus();
  </script>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOT CONTROLLER] Operations Command Center live at:`);
  console.log(`• Local:   http://localhost:${PORT}`);
  console.log(`• Network: http://172.16.118.138:${PORT}`);
});
