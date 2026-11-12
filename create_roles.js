try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch(e) {}
const https = require('https');

const token = 'process.env.DISCORD_TOKEN';
const guildId = '1570430997999263895';

const rolesToCreate = [
  { name: '👑 Owner', color: 0xFFD700, hoist: true, mentionable: true },
  { name: '🛡️ Moderator', color: 0x00E5FF, hoist: true, mentionable: true },
  { name: '🔥 Supreme VIP', color: 0xFF3333, hoist: true, mentionable: true },
  { name: '⭐ VIP', color: 0x00FF88, hoist: true, mentionable: true },
  { name: '⚔️ Survivalist', color: 0x94A3B8, hoist: true, mentionable: false }
];

async function createRoles() {
  for (const role of rolesToCreate) {
    const data = JSON.stringify(role);
    await new Promise(resolve => {
      const req = https.request({
        hostname: 'discord.com',
        path: `/api/v10/guilds/${guildId}/roles`,
        method: 'POST',
        headers: {
          'Authorization': 'Bot ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'DiscordBot'
        }
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`Role [${role.name}] created! Status: ${res.statusCode}`);
          resolve();
        });
      });
      req.write(data);
      req.end();
    });
  }
  console.log('All Minecraft roles created successfully!');
}

createRoles();
