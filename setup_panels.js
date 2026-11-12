try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch(e) {}
const { Client, GatewayIntentBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = 'process.env.DISCORD_TOKEN';
const GUILD_ID = '1570430997999263895';

client.once('clientReady', async () => {
  const g = client.guilds.cache.get(GUILD_ID);
  if (!g) {
    console.error('Guild not found');
    process.exit(1);
  }

  // 1. Setup #support-and-tickets channel with Support Desk panel
  let supportChan = g.channels.cache.find(c => c.name === 'support-and-tickets' || c.name === 'support');
  if (!supportChan) {
    supportChan = await g.channels.create({
      name: 'support-and-tickets',
      type: ChannelType.GuildText,
      topic: '🎟️ Need help, reporting a hacker or griefing? Click below to open a ticket with staff!'
    });
  }

  const sEmbed = new EmbedBuilder()
    .setTitle('🎟️ MEXVERSE SMP — Official Support & Report Desk')
    .setDescription(
      'Welcome to the MEXVERSE Support Portal!\n\n' +
      'Need staff assistance, want to report griefing/hackers, or have a rank question?\n\n' +
      'Click one of the buttons below to open an **instant private ticket channel** with Owner **MEXXZ** and the **Moderator Staff** team:\n\n' +
      '🚨 **Report Grief / Hacker:** Submit griefing coordinates or hacker reports\n' +
      '💎 **Rank & Store Help:** Billing, VIP kits, or rank activation\n' +
      '❓ **General Support:** Land claiming, server commands, or general help'
    )
    .setColor(0x00E5FF)
    .setFooter({ text: 'MEXVERSE SMP • Professional Ticket Desk' });

  const sRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_create_grief').setLabel('🚨 Report Grief / Hacker').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_create_rank').setLabel('💎 Rank / Store Help').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_create_general').setLabel('❓ General Support').setStyle(ButtonStyle.Primary)
  );

  await supportChan.send({ embeds: [sEmbed], components: [sRow] });
  console.log('Support desk deployed to #' + supportChan.name);

  // 2. Setup #server-status channel
  let statusChan = g.channels.cache.find(c => c.name === 'server-status');
  if (!statusChan) {
    statusChan = await g.channels.create({
      name: 'server-status',
      type: ChannelType.GuildText,
      topic: '🟢 Auto-updating live MEXVERSE SMP server monitor'
    });
  }

  // Create voice counter
  let voiceCounter = g.channels.cache.find(c => c.type === ChannelType.GuildVoice && (c.name.includes('Online:') || c.name.includes('MEXVERSE:')));
  if (!voiceCounter) {
    voiceCounter = await g.channels.create({
      name: '🔴 MEXVERSE: Offline',
      type: ChannelType.GuildVoice,
      permissionOverwrites: [{ id: g.id, deny: [PermissionFlagsBits.Connect] }]
    });
  }

  const statusEmbed = new EmbedBuilder()
    .setTitle('🟢 MEXVERSE SMP — Live Realm Status')
    .setDescription(
      '**Server Crossplay Connection:**\n' +
      '• **Java Server IP:** `mexverse.qd.je`\n' +
      '• **Tunnel IP:** `impairment-telling.tun.ply.gg:65482`\n' +
      '• **Bedrock IP:** `impairment-insider.tun.ply.gg` | **Port:** `22938`\n\n' +
      '*(Live monitor auto-updates every 2 minutes)*'
    )
    .addFields(
      { name: '👥 Warriors Online', value: '**0 / 50**', inline: true },
      { name: '⚡ Realm Ping', value: '`~18ms`', inline: true },
      { name: '📦 Engine', value: '`Paper 1.20+`', inline: true }
    )
    .setColor(0x00FF88)
    .setFooter({ text: 'Auto-updates every 2 minutes • MEXVERSE SMP' })
    .setTimestamp();

  const statusMsg = await statusChan.send({ embeds: [statusEmbed] });
  const cfg = db.getConfig();
  cfg.statusChannelId = statusChan.id;
  cfg.statusMessageId = statusMsg.id;
  cfg.voiceChannelId = voiceCounter.id;
  db.saveConfig();

  console.log('Server status deployed to #' + statusChan.name);
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
