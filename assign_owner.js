try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch(e) {}
const https = require('https');

const token = 'process.env.DISCORD_TOKEN';
const guildId = '1570430997999263895';
const ownerUserId = '1551635947660247160';

https.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
  headers: { 'Authorization': 'Bot ' + token, 'User-Agent': 'DiscordBot' }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const roles = JSON.parse(body);
    const ownerRole = roles.find(r => r.name.includes('Owner'));
    if (!ownerRole) return console.log('Owner role not found');

    const req = https.request({
      hostname: 'discord.com',
      path: `/api/v10/guilds/${guildId}/members/${ownerUserId}/roles/${ownerRole.id}`,
      method: 'PUT',
      headers: {
        'Authorization': 'Bot ' + token,
        'User-Agent': 'DiscordBot'
      }
    }, res2 => {
      console.log(`Assigned [${ownerRole.name}] to Mexxz lyn! Status: ${res2.statusCode}`);
    });
    req.end();
  });
});
