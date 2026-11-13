const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  ChannelType 
} = require('discord.js');
const path = require('path');
process.loadEnvFile(path.join(__dirname, '.env'));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    console.log(`Connected to guild: ${guild.name}`);

    // 1. Ensure Roles
    const rolesToCreate = [
      { name: '🥉 Novice (5h+)', color: 0xCD7F32 },
      { name: '🥈 Veteran (25h+)', color: 0xC0C0C0 },
      { name: '🥇 No-Life Grinder (100h+)', color: 0xFFD700 }
    ];

    for (const r of rolesToCreate) {
      let role = guild.roles.cache.find(existing => existing.name === r.name);
      if (!role) {
        role = await guild.roles.create({
          name: r.name,
          color: r.color,
          reason: 'Automated Playtime Milestone Role'
        });
        console.log(`Created role: ${role.name}`);
      } else {
        console.log(`Role already exists: ${role.name}`);
      }
    }

    // 2. Ensure Channel #⚔️┃realm-feed
    let feedChan = guild.channels.cache.find(c => c.name.includes('realm-feed'));
    if (!feedChan) {
      const monitorCategory = guild.channels.cache.find(c => c.name.includes('REALM MONITOR') && c.type === ChannelType.GuildCategory);
      feedChan = await guild.channels.create({
        name: '⚔️┃realm-feed',
        type: ChannelType.GuildText,
        parent: monitorCategory ? monitorCategory.id : undefined,
        topic: 'Live in-game deaths, rare advancements, and PvP bounties • MEXVERSE SMP',
        permissionOverwrites: [
          { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] }
        ]
      });
      console.log(`Created channel: #${feedChan.name} (${feedChan.id})`);
    } else {
      console.log(`Channel already exists: #${feedChan.name} (${feedChan.id})`);
    }

  } catch (err) {
    console.error('Setup error:', err);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
