try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch(e) {}
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on('ready', () => {
  console.log('GUILD_MEMBERS_INTENT_SUCCESS');
  process.exit(0);
});

client.on('error', (err) => {
  console.log('ERROR:', err);
  process.exit(1);
});

client.login('process.env.DISCORD_TOKEN').catch(err => {
  console.log('LOGIN_FAILED:', err.message);
  process.exit(1);
});
