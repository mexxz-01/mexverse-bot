try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch(e) {}
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const db = require('./db');

const TOKEN = 'process.env.DISCORD_TOKEN';
const GUILD_ID = '1570430997999263895';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
  console.log('[ORGANIZER] Connected as ' + client.user.tag);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  // Get Roles
  const modRole = guild.roles.cache.find(r => r.name.includes('Moderator'));
  const ownerId = guild.ownerId;

  // Helper to find or create category
  async function ensureCategory(name, position, privateForStaff = false) {
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(name.toLowerCase().replace(/[^a-z]/g, '')));
    const overwrites = [
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel] }
    ];
    if (privateForStaff) {
      overwrites[0] = { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] };
      if (modRole) overwrites.push({ id: modRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      overwrites.push({ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
    }

    if (!cat) {
      cat = await guild.channels.create({
        name: name,
        type: ChannelType.GuildCategory,
        position: position,
        permissionOverwrites: overwrites
      });
      console.log(`[CREATED CAT] ${name}`);
    } else {
      await cat.setName(name);
      await cat.setPosition(position);
      if (privateForStaff) {
        await cat.permissionOverwrites.set(overwrites);
      }
    }
    return cat;
  }

  // Helper to find or create text channel
  async function ensureTextChannel(name, cat, readOnly = false, topic = '') {
    let chan = guild.channels.cache.find(c => c.type === ChannelType.GuildText && (c.name === name || c.name.replace(/[^a-z0-9]/g, '') === name.replace(/[^a-z0-9]/g, '')));
    const overwrites = [
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel] }
    ];
    if (readOnly) {
      overwrites.push({ id: guild.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] });
      overwrites.push({ id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
      if (modRole) overwrites.push({ id: modRole.id, allow: [PermissionFlagsBits.SendMessages] });
    }

    if (!chan) {
      chan = await guild.channels.create({
        name: name,
        type: ChannelType.GuildText,
        parent: cat.id,
        topic: topic,
        permissionOverwrites: overwrites
      });
      console.log(`[CREATED CHAN] #${name}`);
    } else {
      await chan.setName(name);
      await chan.setParent(cat.id, { lockPermissions: false });
      if (topic) await chan.setTopic(topic);
      if (readOnly) {
        for (const ow of overwrites) {
          await chan.permissionOverwrites.edit(ow.id, ow.allow ? { ViewChannel: true, SendMessages: true } : { SendMessages: false, AddReactions: false });
        }
      }
    }
    return chan;
  }

  // Helper for voice channel
  async function ensureVoiceChannel(name, cat, locked = false) {
    let chan = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && (c.name.toLowerCase().includes(name.toLowerCase().slice(3)) || c.name === name));
    const overwrites = [];
    if (locked) {
      overwrites.push({ id: guild.id, deny: [PermissionFlagsBits.Connect] });
    }

    if (!chan) {
      chan = await guild.channels.create({
        name: name,
        type: ChannelType.GuildVoice,
        parent: cat.id,
        permissionOverwrites: overwrites
      });
      console.log(`[CREATED VOICE] ${name}`);
    } else {
      await chan.setName(name);
      await chan.setParent(cat.id, { lockPermissions: false });
      if (locked) {
        await chan.permissionOverwrites.edit(guild.id, { Connect: false });
      }
    }
    return chan;
  }

  // ==========================================
  // 1. CATEGORY: INFORMATION
  // ==========================================
  const catInfo = await ensureCategory('📌 ━━ INFORMATION ━━', 0);
  const rulesChan = await ensureTextChannel('📜┃rules-and-faq', catInfo, true, '📜 Official MEXVERSE SMP Rules, claims guide, and realm etiquette');
  const annChan = await ensureTextChannel('📢┃announcements', catInfo, true, '📢 Official realm updates, resets, and events from MEXXZ');
  const ipChan = await ensureTextChannel('🌐┃server-ip', catInfo, true, '🌐 Connection IP, Bedrock Port & Website for MEXVERSE SMP');
  const rolesChan = await ensureTextChannel('🎭┃select-roles', catInfo, true, '🎭 Pick notification and platform roles');

  // ==========================================
  // 2. CATEGORY: REALM STATUS
  // ==========================================
  const catStatus = await ensureCategory('📊 ━━ REALM MONITOR ━━', 1);
  const statusChan = await ensureTextChannel('🟢┃server-status', catStatus, true, '🟢 Real-time Minecraft server monitor (updates every 2m)');
  const voiceCounter = await ensureVoiceChannel('🔴 MEXVERSE: Offline', catStatus, true);

  // ==========================================
  // 3. CATEGORY: COMMUNITY CHAT
  // ==========================================
  const catCommunity = await ensureCategory('💬 ━━ COMMUNITY ━━', 2);
  const generalChan = await ensureTextChannel('💬┃general-chat', catCommunity, false, '💬 Main chat for all MEXVERSE warriors');
  const mediaChan = await ensureTextChannel('📸┃media-and-clips', catCommunity, false, '📸 Flex your bases, gear, and clutch moments');
  const cmdsChan = await ensureTextChannel('🤖┃bot-commands', catCommunity, false, '🤖 Execute /player, /balance, /daily, /shop, /top');
  const inGameChan = await ensureTextChannel('⛏️┃in-game-chat', catCommunity, false, '⛏️ Live Minecraft chat bridge (talk with players in-game!)');

  // ==========================================
  // 4. CATEGORY: HALL OF FAME
  // ==========================================
  const catHall = await ensureCategory('⭐ ━━ HALL OF FAME ━━', 3);
  const hallChan = await ensureTextChannel('⭐┃hall-of-fame', catHall, true, '🏆 Community-starred builds and clips (3+ ⭐ reactions)');

  // ==========================================
  // 5. CATEGORY: SUPPORT & TICKETS
  // ==========================================
  const catSupport = await ensureCategory('🎟️ ━━ HELP & TICKETS ━━', 4);
  const supportChan = await ensureTextChannel('🎫┃open-a-ticket', catSupport, true, '🎟️ One-Click Support Desk for griefing reports and rank assistance');

  // ==========================================
  // 6. CATEGORY: VOICE CHANNELS
  // ==========================================
  const catVoice = await ensureCategory('🔊 ━━ VOICE CHANNELS ━━', 5);
  await ensureVoiceChannel('🔊 Survival Lounge', catVoice, false);
  await ensureVoiceChannel('🔊 Duo Squad 1', catVoice, false);
  await ensureVoiceChannel('🔊 Duo Squad 2', catVoice, false);
  await ensureVoiceChannel('💤 AFK Chamber', catVoice, false);

  // ==========================================
  // 7. CATEGORY: STAFF HQ (HIDDEN)
  // ==========================================
  const catStaff = await ensureCategory('🛡️ ━━ STAFF HQ ━━', 6, true);
  await ensureTextChannel('🔒┃staff-chat', catStaff, false, 'Staff team internal communications');
  await ensureTextChannel('💻┃staff-console', catStaff, false, 'Server terminal and DiscordSRV console');

  // ==========================================
  // DEPLOY EMBEDS
  // ==========================================

  // 1. Rules Embed
  const rulesEmbed = new EmbedBuilder()
    .setTitle('📜 MEXVERSE SMP — Official Realm Rules & Code of Conduct')
    .setDescription(
      'Welcome to **MEXVERSE SMP**! To keep our world enjoyable and fair for all adventurers, please review and follow our kingdom guidelines:\n\n' +
      '**1. 🚫 No Griefing or Stealing**\n' +
      '• Protect your builds and chest storage using the `/claim` tool (Golden Shovel).\n' +
      '• Unclaimed property is still subject to theft review by Staff.\n\n' +
      '**2. ⚔️ No Hacking or Unfair Advantages**\n' +
      '• X-Ray texture packs, baritone, auto-clickers, and movement hacks result in an **instant permanent ban**.\n\n' +
      '**3. 🤝 Respect the Community**\n' +
      '• Zero tolerance for hate speech, harassment, or excessive toxicity.\n' +
      '• Keep chat friendly and supportive in all public channels.\n\n' +
      '**4. 🛑 No Spamming or Unauthorized Promotion**\n' +
      '• Do not advertise other Discord servers or external links without Staff approval.\n\n' +
      '**5. 👑 Staff Decisions are Final**\n' +
      '• Respect rulings made by Owner **MEXXZ** and the **Moderator Team**.\n\n' +
      'Need help? Visit <#' + supportChan.id + '> to open a private ticket!'
    )
    .setColor(0xEF4444)
    .setFooter({ text: 'MEXVERSE SMP • Safe & Fair Play Guaranteed' })
    .setTimestamp();
  await rulesChan.send({ embeds: [rulesEmbed] });

  // 2. Server IP Embed
  const ipEmbed = new EmbedBuilder()
    .setTitle('⚔️ MEXVERSE SMP — Official Server Connection Info')
    .setDescription(
      'Join our crossplay realm from any edition of Minecraft!\n\n' +
      '**🖥️ JAVA EDITION (PC):**\n' +
      '• Server IP: `mexverse.qd.je`\n' +
      '• Fallback IP: `impairment-telling.tun.ply.gg:65482`\n\n' +
      '**📱 BEDROCK EDITION (Mobile / Consoles / Win10):**\n' +
      '• Server IP: `impairment-insider.tun.ply.gg`\n' +
      '• Port: `22938`\n\n' +
      '🌐 **Official Animated Website:** https://mexverse-smp.vercel.app\n' +
      '🎁 **Free In-Game Starter Kit:** `/kit starter`'
    )
    .setColor(0x00FF88)
    .setFooter({ text: 'MEXVERSE SMP • Crossplay Enabled' });
  await ipChan.send({ embeds: [ipEmbed] });

  // 3. Reaction Roles Embed
  const roleEmbed = new EmbedBuilder()
    .setTitle('🎭 MEXVERSE SMP — Notification & Platform Roles')
    .setDescription(
      'Click the buttons below to assign or remove roles on your profile:\n\n' +
      '☕ **Java Player:** Playing on PC Java Edition\n' +
      '📱 **Bedrock Player:** Playing on Mobile, Console, or Switch\n' +
      '🔔 **Server Updates:** Receive pings for updates, resets & events'
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'Click any button to toggle' });

  const roleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('role_java').setLabel('☕ Java Player').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('role_bedrock').setLabel('📱 Bedrock Player').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('role_alerts').setLabel('🔔 Server Updates').setStyle(ButtonStyle.Secondary)
  );
  await rolesChan.send({ embeds: [roleEmbed], components: [roleRow] });

  // 4. Support Ticket Desk Embed
  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎟️ MEXVERSE SMP — Support & Report Center')
    .setDescription(
      'Have an issue in the realm, need staff assistance, or want to report a rule-breaker?\n\n' +
      'Click one of the buttons below to open an **instant private channel** with Owner **MEXXZ** and the **Moderator Team**:\n\n' +
      '🚨 **Report Grief / Hacker:** Submit coordinates & evidence\n' +
      '💎 **Rank & Store Help:** Rank activation, kits & billing\n' +
      '❓ **General Support:** Land claiming, commands & help'
    )
    .setColor(0x00E5FF)
    .setFooter({ text: 'MEXVERSE SMP • Professional Ticket Desk' });

  const ticketRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_create_grief').setLabel('🚨 Report Grief / Hacker').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_create_rank').setLabel('💎 Rank / Store Help').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_create_general').setLabel('❓ General Support').setStyle(ButtonStyle.Primary)
  );
  await supportChan.send({ embeds: [ticketEmbed], components: [ticketRow] });

  // 5. Server Status Monitor Embed
  const statusEmbed = new EmbedBuilder()
    .setTitle('🟢 MEXVERSE SMP — Live Realm Status')
    .setDescription(
      '**Server Crossplay Connection:**\n' +
      '• **Java Server IP:** `mexverse.qd.je`\n' +
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
  const stMsg = await statusChan.send({ embeds: [statusEmbed] });

  // Update Database Config
  const cfg = db.getConfig();
  cfg.statusChannelId = statusChan.id;
  cfg.statusMessageId = stMsg.id;
  cfg.voiceChannelId = voiceCounter.id;
  db.saveConfig();

  console.log('[SUCCESS] Complete Discord Server Makeover finished!');
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
