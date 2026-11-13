const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function loadData(name, defaultVal = {}) {
  try {
    const file = getFilePath(name);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2));
      return defaultVal;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Error loading ${name}.json:`, err);
    return defaultVal;
  }
}

function saveData(name, data) {
  try {
    const file = getFilePath(name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error saving ${name}.json:`, err);
  }
}

// Memory caches
let economy = loadData('economy', {});
let linked = loadData('linked', {});
let tickets = loadData('tickets', { open: {}, counter: 0 });
let starboard = loadData('starboard', {});
let bounties = loadData('bounties', {});
let playtime = loadData('playtime', {});
let serverConfig = loadData('config', { statusMessageId: null, statusChannelId: null, voiceChannelId: null });

module.exports = {
  // Economy & XP
  getEconomy(userId) {
    if (!economy[userId]) {
      economy[userId] = {
        coins: 100, // starting bonus
        xp: 0,
        level: 1,
        lastDaily: 0,
        lastMessage: 0,
        inventory: []
      };
      saveData('economy', economy);
    }
    return economy[userId];
  },
  saveEconomy() {
    saveData('economy', economy);
  },
  getAllEconomy() {
    return economy;
  },

  // Linked Accounts
  getLinked(userId) {
    return linked[userId] || null;
  },
  setLinked(userId, data) {
    linked[userId] = data;
    saveData('linked', linked);
  },
  removeLinked(userId) {
    delete linked[userId];
    saveData('linked', linked);
  },
  getAllLinked() {
    return linked;
  },

  // Tickets
  getTickets() {
    return tickets;
  },
  saveTickets() {
    saveData('tickets', tickets);
  },

  // Starboard
  getStarboard() {
    return starboard;
  },
  saveStarboard() {
    saveData('starboard', starboard);
  },

  // Bounties
  getBounties() {
    return bounties;
  },
  saveBounties() {
    saveData('bounties', bounties);
  },

  // Playtime
  getPlaytime() {
    return playtime;
  },
  savePlaytime() {
    saveData('playtime', playtime);
  },

  // Config
  getConfig() {
    return serverConfig;
  },
  saveConfig() {
    saveData('config', serverConfig);
  }
};
