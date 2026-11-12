# ⚔️ MEXVERSE GUARDIAN — Official SMP Discord Bot & Controller System

A high-performance Discord Bot, Real-Time Realm Monitor, Automated UPI Payment Gateway, and Android Companion Controller tailored for the **MEXVERSE SMP** Minecraft community.

---

## 🌟 Key Features

### 1. 🎮 Minecraft Player & 3D Skin Inspector
- `/player <name>`: Full 3D rendered skin preview, Java / Bedrock UUID lookup, and server stats.
- `/skin <name>`: High-definition skin viewer with interactive front & back view options.

### 2. 📊 Live Server Status & Dynamic Voice Counter
- Automatically monitors `mexverse.qd.je` (Java) & `impairment-insider.tun.ply.gg:22938` (Bedrock).
- Dynamic locked voice channel displaying real-time player count: `🟢 Online: 12/50 Players` or `🔴 MEXVERSE: Offline`.
- Detailed status embed in `#🟢┃server-status` with TPS, latency, and online player rosters.

### 3. 🎟️ One-Click Support Ticket & Staff Resolution System
- `#🎫┃open-a-ticket`: Interactive buttons for **[🚨 Report Grief / Hacker]** and **[💎 Rank / Store Help]**.
- Instantly creates an encrypted private room accessible only to the requester and the Moderation team.
- `/fix-issue <member> [topic]`: 1-on-1 private staff room with instant transcript generation dispatched to `#🔒┃staff-logs`.

### 4. 💎 Real-Money Rank Store with Automated UPI & 12-Digit UTR Verification
- In `#💎┃realm-store` and `/store`:
  - **VIP Rank**: ₹29 / month
  - **Supreme VIP Rank**: ₹70 / month
- Generates dynamic, scannable UPI QR codes configured with receiver UPI ID `mexxz@slc`.
- **UTR Modal Verification**: Prompts players to submit their 12-digit bank reference number (UTR).
- **Direct Owner Approval Flow**: Automatically dispatches a DM to the Server Owner with `[Approve]` & `[Reject]` action buttons.

### 5. 💰 SMP Economy, XP Leveling & Leaderboards
- Earn **MexCoins** by chatting and participating in voice channels.
- Commands: `/daily`, `/balance`, `/shop`, `/buy`, `/rank`, and `/top`.
- Starboard: Posts receiving 5+ ⭐ reactions are automatically immortalized in `#⭐┃hall-of-fame`.

### 6. 📱 Android Companion App & Web Control Dashboard
- Native lightweight Android APK (`MEXVERSE-Bot-Switch.apk`) to toggle the bot ON or OFF with a single tap.
- Built-in Node.js control server (`http://localhost:4444`) with dark-themed dashboard, real-time RAM/uptime monitoring, and live console streams.

---

## 🚀 Quick Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v20.6.0 or higher
- Discord Application & Bot Token with Privileged Gateway Intents (Server Members & Message Content)

### 1. Clone & Configure
```bash
git clone https://github.com/mexxz-01/mexverse-bot.git
cd mexverse-bot
npm install
```

### 2. Setup Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_guild_id
OWNER_ID=your_discord_user_id
UPI_ID=mexxz@slc
PORT=4444
```

### 3. Start the Bot & Controller
```bash
# Start Discord Bot directly:
node index.js

# Or start the Web Controller + Bot Manager:
node control_app/server.js
```

---

## 📂 Project Architecture

```
mexverse-bot/
├── index.js                     # Core Discord bot engine & command handlers
├── db.js                        # JSON persistent database store
├── control_app/                 # Web control server & dashboard (Port 4444)
│   ├── server.js                # Express/HTTP server managing bot child process
│   └── public/index.html        # Futuristic cyberpunk web controller UI
├── android_app/                 # Native Android APK source code
│   ├── src/                     # Java source (MainActivity.java)
│   ├── res/                     # Vector icons & layouts
│   └── build.ps1                # Zero-dependency PowerShell native APK compiler
├── data/                        # Persistent JSON databases (Economy, Tickets, Starboard)
├── .env.example                 # Template for environment configuration
└── README.md                    # Project documentation
```

---

## 🛡️ License
Private & Proprietary — Developed for MEXVERSE SMP Community.
