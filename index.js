process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const http = require('http');
const net = require('net');

function sendMinecraftRcon(cmd) {
  return new Promise((resolve) => {
    const client = net.createConnection({ port: 25575, host: '127.0.0.1' });
    let reqId = 1;
    let authed = false;

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

    client.on('connect', () => {
      sendPacket(reqId++, 3, 'mexverseAdmin2026');
    });

    client.on('data', data => {
      if (!authed) {
        authed = true;
        sendPacket(reqId++, 2, cmd);
      } else {
        const str = data.slice(12, data.length - 2).toString('utf8');
        client.end();
        resolve(str);
      }
    });

    client.on('error', err => resolve('[RCON ERROR: ' + err.message + ']'));
    setTimeout(() => { client.destroy(); resolve('[RCON TIMEOUT]'); }, 4000);
  });
}

const db = require('./db');

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch (e) {}

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1570434280549519514';
const GUILD_ID = process.env.GUILD_ID || '1570430997999263895';
const IN_GAME_CHAT_CHANNEL_ID = process.env.IN_GAME_CHAT_CHANNEL_ID || '1570435509371670588';
const UPI_ID = process.env.UPI_ID || 'mexxz@slc';

// Cloud & Render HTTP Health Check Server
const WEB_PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 10000 : null);
if (WEB_PORT) {
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', bot: client?.user?.tag || 'online' }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MEXVERSE GUARDIAN</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 35px 25px; border-radius: 20px; text-align: center; border: 1px solid #334155; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: #10b981; color: #022c22; padding: 6px 14px; border-radius: 99px; font-weight: bold; margin-bottom: 15px; font-size: 13px; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">🟢 ONLINE 24/7</div>
            <h1>MEXVERSE GUARDIAN</h1>
            <p>Official Discord Bot, Live Server Monitor & Automated Payment Gateway are active on Render.</p>
          </div>
        </body>
      </html>
    `);
  });

  httpServer.listen(WEB_PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Render health check server listening on port ${WEB_PORT}`);
  }).on('error', (err) => {
    console.warn(`[HTTP] Health check server port warning: ${err.message}`);
  });
}

const JAVA_IP = 'impairment-telling.tun.ply.gg:65482';
const DISPLAY_JAVA_IP = 'mexverse.qd.je';
const BEDROCK_IP = 'impairment-insider.tun.ply.gg';
const BEDROCK_PORT = '22938';

function createClient(withPrivilegedIntents = true) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ];
  if (withPrivilegedIntents) {
    intents.push(GatewayIntentBits.GuildMembers);
    intents.push(GatewayIntentBits.MessageContent);
  }
  return new Client({
    intents: intents,
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction, Partials.User]
  });
}

let client = createClient(true);

// ==========================================
// 1. SLASH COMMANDS DEFINITION
// ==========================================
const commands = [
  // --- OWNER ONLY ROLE MANAGEMENT (INCLUDING HEAD MODERATOR) ---
  new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('👑 [OWNER ONLY] Assign or promote a player to a Minecraft / Staff rank')
    .addUserOption(opt => opt.setName('user').setDescription('Target player').setRequired(true))
    .addStringOption(opt =>
      opt.setName('role')
        .setDescription('Rank to assign')
        .setRequired(true)
        .addChoices(
          { name: '🛡️ Head Moderator (Senior Staff Authority)', value: 'headmod' },
          { name: '🛡️ Moderator (Staff Guardian)', value: 'mod' },
          { name: '🎥 Creator (Content Partner)', value: 'creator' },
          { name: '🔥 Supreme VIP (Apex Donor)', value: 'supreme' },
          { name: '⭐ VIP (Supporter Rank)', value: 'vip' },
          { name: '⚔️ Survivalist (Member)', value: 'survivalist' },
          { name: '❌ Remove All Ranks', value: 'remove' }
        )
    )
    .addStringOption(opt => opt.setName('reason').setDescription('Reason or achievement for promotion'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // --- PRIVATE ISSUE & SUPPORT SESSION COMMAND ---
  new SlashCommandBuilder()
    .setName('fix-issue')
    .setDescription('🛠️ [STAFF] Create an ultra-private 1-on-1 session channel to talk & fix a member issue')
    .addUserOption(opt => opt.setName('member').setDescription('The member who needs assistance').setRequired(true))
    .addStringOption(opt => opt.setName('topic').setDescription('Issue summary or inquiry topic'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // --- REAL-MONEY RANK STORE COMMAND ---
  new SlashCommandBuilder()
    .setName('store')
    .setDescription('💎 View VIP (₹29/mo) and Supreme VIP (₹70/mo) founder perks, UPI payment & UTR submit'),

  // --- 1. LIVE MINECRAFT PLAYER CARD & 3D SKIN ---
  new SlashCommandBuilder()
    .setName('player')
    .setDescription('🎮 View a player Minecraft profile with live 3D skin & rank stats')
    .addStringOption(opt => opt.setName('username').setDescription('Minecraft gamertag (leave empty to view your linked account)')),

  new SlashCommandBuilder()
    .setName('skin')
    .setDescription('👕 Inspect & download a player 3D Minecraft skin')
    .addStringOption(opt => opt.setName('username').setDescription('Minecraft gamertag').setRequired(true)),

  // --- 2. LIVE SERVER STATUS & STATS ---
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('📊 Check live MEXVERSE SMP server status, TPS, ping, and online players'),

  new SlashCommandBuilder()
    .setName('setup-status')
    .setDescription('⚙️ [ADMIN] Deploy auto-updating #server-status card & dynamic voice counter')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // --- 3. SUPPORT TICKET SYSTEM ---
  new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('🎟️ [ADMIN] Deploy the interactive One-Click Support Ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎟️ Create a private support ticket with staff')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Ticket category')
        .setRequired(true)
        .addChoices(
          { name: '🚨 Report Grief / Hacker', value: 'grief' },
          { name: '💎 Rank / Store Help', value: 'rank' },
          { name: '❓ General Question', value: 'general' }
        )
    ),

  // --- 4. SMP ECONOMY & LEVELING ---
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('💰 Claim your 250 daily MexCoins bonus'),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💳 View your MexCoins balance, level, XP progress bar, and inventory')
    .addUserOption(opt => opt.setName('user').setDescription('Target member (optional)')),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🛒 Browse the MexStore for Discord roles, crate keys, and vouchers'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('🛍️ Purchase an item from the MexStore')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Item identifier')
        .setRequired(true)
        .addChoices(
          { name: '🎨 Custom Role Color (500 MexCoins)', value: 'role_color' },
          { name: '🔑 In-Game Mystery Crate Key (1,000 MexCoins)', value: 'crate_key' },
          { name: '🎟️ Realm Event Ticket (200 MexCoins)', value: 'raffle_ticket' },
          { name: '👑 25% Off VIP Rank Voucher (3,000 MexCoins)', value: 'vip_voucher' }
        )
    ),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('🏆 View the MEXVERSE SMP Leaderboard (MexCoins & Levels)'),

  // --- 5. MINECRAFT ACCOUNT LINKER ---
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('🔗 Link your Minecraft account to your Discord profile')
    .addStringOption(opt => opt.setName('gamertag').setDescription('Your in-game Minecraft name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('❌ Unlink your Minecraft account from your Discord profile'),

  // --- 7. BOSS & EVENT BROADCAST ---
  new SlashCommandBuilder()
    .setName('broadcast-event')
    .setDescription('📢 [STAFF] Broadcast a mythic realm achievement, boss victory, or death event')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Event type')
        .setRequired(true)
        .addChoices(
          { name: '🐉 Ender Dragon Slain', value: 'dragon' },
          { name: '💀 Wither Defeated', value: 'wither' },
          { name: '⚔️ Realm Tournament / Event', value: 'tournament' },
          { name: '🔥 Epic Death Alert', value: 'death' }
        )
    )
    .addStringOption(opt => opt.setName('player').setDescription('Player name').setRequired(true))
    .addStringOption(opt => opt.setName('details').setDescription('Extra details or funny death message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // --- ADMIN CRATE KEYS MANAGEMENT ---
  new SlashCommandBuilder()
    .setName('give-crate-key')
    .setDescription('🔑 [ADMIN ONLY] Grant in-game mystery crate keys to a player or everyone')
    .addStringOption(opt =>
      opt.setName('crate')
        .setDescription('Select crate type')
        .setRequired(true)
        .addChoices(
          { name: '🔥 Prime Crate (Legendary / God Tier)', value: 'prime_crate' },
          { name: '🩸 Crimson Crate (Mythic Tier)', value: 'crimson_crate' },
          { name: '💰 Gold Crate (Epic Tier)', value: 'gold_crate' },
          { name: '🔮 Amethyst Crate (Rare Tier)', value: 'amethyst_crate' },
          { name: '📦 Common Crate (Starter Tier)', value: 'common_crate' }
        ))
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of keys to grant (1 - 64)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(64))
    .addStringOption(opt =>
      opt.setName('player')
        .setDescription('Minecraft Player Gamertag (IGN). Leave empty if using keyall.')
        .setRequired(false))
    .addBooleanOption(opt =>
      opt.setName('keyall')
        .setDescription('Set true to give keys to EVERY online player on the server!')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('crate-list')
    .setDescription('🎁 View all server mystery crates, tiers, and rewards'),

  // --- MODERATION ---
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk delete 1 to 100 messages from the channel')
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout/mute a member for a specified duration')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Warning reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // --- AUTOMATED COMMUNITY TOOLS ---
  new SlashCommandBuilder()
    .setName('setup-roles')
    .setDescription('Deploy interactive reaction buttons for Java, Bedrock, and Notification roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create an automated community poll with voting buttons')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('opt1').setDescription('Option 1').setRequired(true))
    .addStringOption(opt => opt.setName('opt2').setDescription('Option 2').setRequired(true))
    .addStringOption(opt => opt.setName('opt3').setDescription('Option 3'))
    .addStringOption(opt => opt.setName('opt4').setDescription('Option 4')),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send a rich announcement embed to a channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Announcement message').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // --- UTILITY ---
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('View server stats, member count, and owner'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View profile information for yourself or another member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user')),

  new SlashCommandBuilder()
    .setName('ip')
    .setDescription('Get Java & Bedrock server connection info'),

  new SlashCommandBuilder()
    .setName('ranks')
    .setDescription('View complete perks & benefits for every role'),

  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Display MEXVERSE SMP realm rules')
].map(cmd => cmd.toJSON());

// Register Slash Commands
const rest = new REST({ version: '10' }).setToken(TOKEN);
async function registerCommands() {
  try {
    console.log('[SLASH] Registering 22+ comprehensive slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('[SLASH] All slash commands successfully registered!');
  } catch (err) {
    console.error('Error registering slash commands:', err);
  }
}

// ==========================================
// HELPER: MINECRAFT SERVER STATUS FETCH
// ==========================================
async function fetchServerStatus() {
  try {
    const res = await fetch(`https://api.mcsrvstat.us/2/${JAVA_IP}`);
    if (!res.ok) return { online: false };
    const data = await res.json();
    return data;
  } catch (err) {
    return { online: false };
  }
}

// ==========================================
// HELPER: PLAYER DATA FETCH (PlayerDB API)
// ==========================================
async function fetchPlayerData(username) {
  try {
    const res = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return data.data.player;
  } catch (err) {
    return null;
  }
}

// ==========================================
// 2. BOT READY & SETUP
// ==========================================
function setupBotHandlers(bClient) {
  bClient.on('error', err => {
    console.error('[CLIENT ERROR]', err);
  });

  bClient.once('clientReady', async () => {
    console.log(`[MEXVERSE BOT] Logged in as ${bClient.user.tag}!`);
    bClient.user.setActivity('over MEXVERSE SMP ⚔️', { type: 3 }); // Watching
    registerCommands();

    // Dynamic Server Status Updater (Every 2 minutes)
    setInterval(async () => {
      try {
        const guild = bClient.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const status = await fetchServerStatus();
        const onlineCount = status.online ? (status.players?.online || 0) : 0;
        const maxCount = status.online ? (status.players?.max || 50) : 50;

        // 1. Update Voice Channel Name
        const config = db.getConfig();
        let voiceChannel = null;
        if (config.voiceChannelId) {
          voiceChannel = guild.channels.cache.get(config.voiceChannelId);
        }
        if (!voiceChannel) {
          voiceChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && (c.name.includes('Online:') || c.name.includes('MEXVERSE:')));
        }
        if (voiceChannel) {
          const targetName = status.online ? `🟢 Online: ${onlineCount}/${maxCount}` : `🔴 MEXVERSE: Offline`;
          if (voiceChannel.name !== targetName) {
            await voiceChannel.setName(targetName).catch(() => {});
          }
        }

        // 2. Update Live Status Channel Message if configured
        if (config.statusChannelId && config.statusMessageId) {
          const stChan = guild.channels.cache.get(config.statusChannelId);
          if (stChan) {
            const stMsg = await stChan.messages.fetch(config.statusMessageId).catch(() => null);
            if (stMsg) {
              const statusEmbed = buildStatusEmbed(status);
              await stMsg.edit({ embeds: [statusEmbed] }).catch(() => {});
            }
          }
        }
      } catch (err) {
        // Silent interval errors
      }
    }, 120000); // 2 minutes
  });

  // ==========================================
  // 3. JOIN & LEAVE ANNOUNCEMENTS
  // ==========================================
  bClient.on('guildMemberAdd', async member => {
    try {
      const channel = member.guild.channels.cache.find(c => c.name.includes('general'));
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ A New Challenger Has Entered the Realm!`)
        .setDescription(
          `Welcome <@${member.id}> to **MEXVERSE SMP**!\n\n` +
          `Prepare your gear, claim your land, and conquer the kingdom.\n\n` +
          `🌐 **Java Server IP:** \`${DISPLAY_JAVA_IP}\`\n` +
          `📱 **Bedrock Port:** \`${BEDROCK_PORT}\`\n` +
          `💬 **Live In-Game Chat:** <#${IN_GAME_CHAT_CHANNEL_ID}>\n` +
          `💎 **Rank Store:** <#1570459560416903258>\n` +
          `✨ **Official Website:** https://mexverse-smp.vercel.app`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0x00FF88)
        .setFooter({ text: `Member #${member.guild.memberCount} • MEXVERSE SMP` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('Join announcement error:', err);
    }
  });

  bClient.on('guildMemberRemove', async member => {
    try {
      const channel = member.guild.channels.cache.find(c => c.name.includes('general'));
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setDescription(`👋 **${member.user.tag}** has left MEXVERSE SMP. We now have **${member.guild.memberCount}** members.`)
        .setColor(0x64748B)
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('Leave announcement error:', err);
    }
  });

  // ==========================================
  // 4. CHAT ACTIVITY: ECONOMY & LEVELING + IN-GAME DEATH FEED
  // ==========================================
  bClient.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Feature 4: Chat Economy & XP
    const userId = message.author.id;
    const userEco = db.getEconomy(userId);
    const now = Date.now();

    // 60-second cooldown for XP to avoid spam
    if (now - userEco.lastMessage > 60000) {
      const earnedXp = Math.floor(Math.random() * 11) + 10; // 10-20 XP
      const earnedCoins = Math.floor(Math.random() * 5) + 3; // 3-7 MexCoins

      userEco.xp += earnedXp;
      userEco.coins += earnedCoins;
      userEco.lastMessage = now;

      const newLevel = Math.floor(0.15 * Math.sqrt(userEco.xp)) + 1;
      if (newLevel > userEco.level) {
        userEco.level = newLevel;
        userEco.coins += 100; // Level up bonus!
        db.saveEconomy();

        try {
          const lvlEmbed = new EmbedBuilder()
            .setTitle('⚡ LEVEL UP!')
            .setDescription(`🎉 Outstanding work <@${userId}>! You just ascended to **Level ${newLevel}**!\n💰 **Bonus Reward:** \`+100 MexCoins\``)
            .setColor(0xF59E0B)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
          await message.channel.send({ embeds: [lvlEmbed] }).catch(() => {});
        } catch (e) {}
      } else {
        db.saveEconomy();
      }
    }

    // Feature 7: Boss & Death Feed Broadcast (if message is in in-game chat)
    if (message.channel.id === IN_GAME_CHAT_CHANNEL_ID) {
      const text = message.content.toLowerCase();
      const isBoss = text.includes('slain the ender dragon') || text.includes('defeated the wither') || text.includes('wither was slain');
      const isDeath = text.includes('slain by') || text.includes('fell from a high place') || text.includes('drowned') || text.includes('blown up') || text.includes('burned to death') || text.includes('tried to swim in lava') || text.includes('hit the ground too hard');

      if (isBoss) {
        const annChan = message.guild.channels.cache.find(c => c.name.includes('announcement'));
        if (annChan) {
          const bossEmbed = new EmbedBuilder()
            .setTitle('🐉 MYTHIC VICTORY — BOSS SLAIN!')
            .setDescription(`🏆 **A legendary conquest has shaken the MEXVERSE!**\n\n\`${message.content}\`\n\nSalute the warriors in <#${IN_GAME_CHAT_CHANNEL_ID}>!`)
            .setColor(0x9333EA)
            .setTimestamp();
          await annChan.send({ embeds: [bossEmbed] }).catch(() => {});
        }
      } else if (isDeath) {
        await message.react('💀').catch(() => {});
      }
    }
  });

  // ==========================================
  // 5. STARBOARD / HALL OF FAME LISTENER (Feature 6)
  // ==========================================
  bClient.on('messageReactionAdd', async (reaction, user) => {
    try {
      if (reaction.emoji.name !== '⭐') return;
      if (reaction.partial) await reaction.fetch();
      const message = reaction.message;
      if (message.partial) await message.fetch();

      const STAR_THRESHOLD = 3;
      if (reaction.count < STAR_THRESHOLD) return;

      const guild = message.guild;
      if (!guild) return;

      const hallChannel = guild.channels.cache.find(c => c.name.includes('hall-of-fame'));
      if (!hallChannel) return;

      const sb = db.getStarboard();
      const existingStarMsgId = sb[message.id];

      const starEmbed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(message.content || '*(Image / Media post)*')
        .addFields({ name: '🌟 Starred', value: `**${reaction.count}** ⭐ in <#${message.channel.id}>`, inline: true })
        .setColor(0xFBBF24)
        .setTimestamp(message.createdAt);

      const imageAttachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
      if (imageAttachment) {
        starEmbed.setImage(imageAttachment.url);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Jump to Original Message 🚀').setStyle(ButtonStyle.Link).setURL(message.url)
      );

      if (existingStarMsgId) {
        const starMsg = await hallChannel.messages.fetch(existingStarMsgId).catch(() => null);
        if (starMsg) {
          await starMsg.edit({ embeds: [starEmbed], components: [row] }).catch(() => {});
          return;
        }
      }

      const sentMsg = await hallChannel.send({ embeds: [starEmbed], components: [row] }).catch(() => {});
      if (sentMsg) {
        sb[message.id] = sentMsg.id;
        db.saveStarboard();
      }
    } catch (err) {
      console.error('Starboard error:', err);
    }
  });

  // ==========================================
  // 6. INTERACTIONS (COMMANDS, BUTTONS & MODALS)
  // ==========================================
  bClient.on('interactionCreate', async interaction => {
    try {
      const guild = interaction.guild;
      const user = interaction.user;

      // ==========================================
      // MODAL SUBMIT: UTR / PAYMENT SUBMISSION
      // ==========================================
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (customId === 'modal_submit_utr_vip' || customId === 'modal_submit_utr_supreme') {
          const isSupreme = customId === 'modal_submit_utr_supreme';
          const rankTitle = isSupreme ? '🔥 SUPREME VIP' : '⭐ VIP';
          const rankKey = isSupreme ? 'supreme' : 'vip';
          const price = isSupreme ? '₹70' : '₹29';

          const utr = interaction.fields.getTextInputValue('input_utr').trim();
          const ign = interaction.fields.getTextInputValue('input_ign').trim();
          const app = interaction.fields.getTextInputValue('input_app')?.trim() || 'UPI';

          await interaction.deferReply().catch(() => {});

          // 1. Confirm to Buyer in their order channel
          const userConfirmEmbed = new EmbedBuilder()
            .setTitle(`⏳ UTR Submitted — Verification in Progress!`)
            .setDescription(
              `Thank you <@${user.id}>! Your payment details have been submitted directly to Server Owner **MEXXZ**.\n\n` +
              `💳 **Rank Ordered:** **${rankTitle}** (${price}/month)\n` +
              `🎮 **Minecraft Gamertag:** \`${ign}\`\n` +
              `🔢 **Submitted 12-Digit UTR:** \`${utr}\`\n` +
              `📱 **Payment Method:** \`${app}\`\n` +
              `📥 **Receiver UPI:** \`${UPI_ID}\`\n\n` +
              `*Owner MEXXZ will verify your transaction against bank records and activate your rank momentarily!*`
            )
            .setColor(0xF59E0B)
            .setFooter({ text: 'MEXVERSE SMP • Payment Verification Desk' })
            .setTimestamp();

          await interaction.editReply({ embeds: [userConfirmEmbed] }).catch(() => {});

          // 2. DISPATCH AUTOMATIC ALERT DIRECTLY TO OWNER DM
          const ownerId = guild ? guild.ownerId : '1551635947660247160';
          let ownerUser = null;
          try {
            ownerUser = await bClient.users.fetch(ownerId);
          } catch (e) {}

          const alertEmbed = new EmbedBuilder()
            .setTitle('🚨 NEW UPI PAYMENT RECEIVED — UTR SUBMITTED!')
            .setDescription(
              `A player has just submitted their UPI transaction details for rank activation:\n\n` +
              `👤 **Buyer (Discord):** <@${user.id}> (\`${user.tag}\`)\n` +
              `🎮 **Minecraft IGN:** \`${ign}\`\n` +
              `💎 **Rank:** **${rankTitle}** (${price}/month)\n` +
              `📥 **Sent To UPI:** \`${UPI_ID}\`\n` +
              `📱 **UPI App:** \`${app}\`\n\n` +
              `🔢 **12-DIGIT UTR / REF ID:**\n` +
              `\`\`\`\n${utr}\n\`\`\`\n` +
              `📍 **Order Channel:** <#${interaction.channel.id}>\n` +
              `🕒 **Submitted At:** <t:${Math.floor(Date.now() / 1000)}:F>`
            )
            .setColor(0x00FF88)
            .setFooter({ text: 'Click [Approve] below to instantly assign Discord role & rank!' })
            .setTimestamp();

          const ownerActionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`approve_rank_${user.id}_${rankKey}_${interaction.channel.id}_${encodeURIComponent(ign)}`)
              .setLabel('✅ Approve & Grant Rank')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`reject_rank_${user.id}_${interaction.channel.id}`)
              .setLabel('❌ Reject / Invalid UTR')
              .setStyle(ButtonStyle.Danger)
          );

          // Send to Owner DM
          if (ownerUser) {
            await ownerUser.send({ embeds: [alertEmbed], components: [ownerActionRow] }).catch(err => {
              console.warn('Could not DM owner directly (DMs might be closed):', err.message);
            });
          }

          // Send to #🔒┃staff-logs as permanent backup
          const logsChan = guild.channels.cache.find(c => c.name.includes('staff-logs'));
          if (logsChan) {
            await logsChan.send({ content: `<@${ownerId}> (New Payment Verification Pending!)`, embeds: [alertEmbed], components: [ownerActionRow] }).catch(() => {});
          }

          return;
        }
      }

      // ==========================================
      // BUTTON HANDLERS
      // ==========================================
      if (interaction.isButton()) {
        const { customId, member } = interaction;

        // 1. Enter UTR Button -> Opens Modal
        if (customId === 'btn_submit_utr_vip' || customId === 'btn_submit_utr_supreme') {
          const isSupreme = customId === 'btn_submit_utr_supreme';
          const modalId = isSupreme ? 'modal_submit_utr_supreme' : 'modal_submit_utr_vip';
          const rankTitle = isSupreme ? 'SUPREME VIP (₹70)' : 'VIP (₹29)';

          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(`Payment Verification — ${rankTitle}`);

          const utrInput = new TextInputBuilder()
            .setCustomId('input_utr')
            .setLabel('12-Digit UTR / UPI Ref ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 4312XXXXXXXX (from your payment receipt)')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(25);

          const ignInput = new TextInputBuilder()
            .setCustomId('input_ign')
            .setLabel('Minecraft In-Game Gamertag (IGN)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your exact Minecraft username')
            .setRequired(true)
            .setMaxLength(30);

          const appInput = new TextInputBuilder()
            .setCustomId('input_app')
            .setLabel('Payment App Used')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('PhonePe / Google Pay / Paytm / BHIM')
            .setRequired(false)
            .setMaxLength(30);

          modal.addComponents(
            new ActionRowBuilder().addComponents(utrInput),
            new ActionRowBuilder().addComponents(ignInput),
            new ActionRowBuilder().addComponents(appInput)
          );

          return interaction.showModal(modal);
        }

        // 2. Owner One-Click Approve Rank Button
        if (customId.startsWith('approve_rank_')) {
          await interaction.deferReply({ flags: 64 }).catch(() => {});

          const parts = customId.split('_');
          const buyerId = parts[2];
          const rankKey = parts[3];
          const orderChannelId = parts[4];
          const ign = decodeURIComponent(parts[5] || '');

          const targetGuild = bClient.guilds.cache.get(GUILD_ID);
          if (!targetGuild) return interaction.editReply({ content: 'Guild not found!' }).catch(() => {});

          const buyerMember = targetGuild.members.cache.get(buyerId);
          const targetRoleName = rankKey === 'supreme' ? '🔥 Supreme VIP' : '⭐ VIP';
          const targetRole = targetGuild.roles.cache.find(r => r.name === targetRoleName);

          if (buyerMember && targetRole) {
            await buyerMember.roles.add(targetRole).catch(() => {});
          }

          // Link account if IGN provided
          if (ign) {
            db.setLinked(buyerId, {
              username: ign,
              uuid: 'Verified Donor',
              linkedAt: Date.now()
            });
          }

          // Notify in the buyer's order channel
          const orderChan = targetGuild.channels.cache.get(orderChannelId);
          if (orderChan) {
            const successEmbed = new EmbedBuilder()
              .setTitle('🎉 PAYMENT VERIFIED & RANK DELIVERED!')
              .setDescription(
                `Awesome news <@${buyerId}>! Server Owner **MEXXZ** has verified your payment!\n\n` +
                `⭐ **Granted Rank:** **${targetRoleName}**\n` +
                `🎮 **Minecraft Gamertag:** \`${ign || 'Linked'}\`\n\n` +
                `Your Discord privileges are now unlocked. Hop onto \`${DISPLAY_JAVA_IP}\` to enjoy your perks!`
              )
              .setColor(0x00FF88)
              .setThumbnail('https://mc-heads.net/head/MHF_Chest')
              .setFooter({ text: 'MEXVERSE SMP • Official Verification' })
              .setTimestamp();

            await orderChan.send({ content: `<@${buyerId}> 🎊 Welcome to ${targetRoleName}!`, embeds: [successEmbed] }).catch(() => {});
          }

          // Log in Staff Logs
          const logsChan = targetGuild.channels.cache.find(c => c.name.includes('staff-logs'));
          if (logsChan) {
            const auditEmbed = new EmbedBuilder()
              .setTitle('✅ RANK ORDER APPROVED & ACTIVATED')
              .setDescription(`Owner **MEXXZ** approved **${targetRoleName}** for <@${buyerId}> (\`${ign}\`).`)
              .setColor(0x10B981)
              .setTimestamp();
            await logsChan.send({ embeds: [auditEmbed] }).catch(() => {});
          }

          return interaction.editReply({ content: `✅ Successfully approved! **${targetRoleName}** has been granted to <@${buyerId}>.` }).catch(() => {});
        }

        // 3. Owner Reject Button
        if (customId.startsWith('reject_rank_')) {
          await interaction.deferReply({ flags: 64 }).catch(() => {});
          const parts = customId.split('_');
          const buyerId = parts[2];
          const orderChannelId = parts[3];

          const targetGuild = bClient.guilds.cache.get(GUILD_ID);
          const orderChan = targetGuild?.channels.cache.get(orderChannelId);

          if (orderChan) {
            const rejectEmbed = new EmbedBuilder()
              .setTitle('⚠️ Payment Verification Notice')
              .setDescription(
                `<@${buyerId}>, Owner **MEXXZ** was unable to locate or verify the submitted UTR in bank records.\n\n` +
                `• Please double-check your payment app receipt.\n` +
                `• Ensure you sent payment to **\`${UPI_ID}\`**.\n` +
                `• Click **[📝 Submit 12-Digit UTR]** to re-submit, or upload a clear screenshot of your transaction here.`
              )
              .setColor(0xEF4444)
              .setFooter({ text: 'MEXVERSE SMP • Order Desk' })
              .setTimestamp();

            await orderChan.send({ embeds: [rejectEmbed] }).catch(() => {});
          }

          return interaction.editReply({ content: `Marked order as rejected. Notification posted to <#${orderChannelId}>.` }).catch(() => {});
        }

        // 4. Resolve & Close Support Issue Channel
        if (customId === 'issue_resolve_close') {
          await interaction.deferReply().catch(() => {});

          const messages = await interaction.channel.messages.fetch({ limit: 50 }).catch(() => null);
          let summary = 'No messages recorded.';
          if (messages && messages.size > 0) {
            summary = messages.reverse().map(m => `[${m.author.username}]: ${m.content || '(Embed/Attachment)'}`).slice(-15).join('\n');
          }

          const logsChan = guild.channels.cache.find(c => c.name.includes('staff-logs') || c.name.includes('staff-chat'));
          if (logsChan) {
            const logEmbed = new EmbedBuilder()
              .setTitle(`📋 ISSUE RESOLUTION REPORT — ${interaction.channel.name}`)
              .addFields(
                { name: '👤 Resolved By', value: `<@${user.id}> (${user.tag})`, inline: true },
                { name: '📍 Channel', value: `\`${interaction.channel.name}\``, inline: true },
                { name: '🕒 Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                { name: '💬 Recent Conversation Snippet', value: `\`\`\`\n${summary.slice(0, 1000)}\n\`\`\`` }
              )
              .setColor(0x10B981)
              .setFooter({ text: 'MEXVERSE SMP • Audit & Moderation Record' })
              .setTimestamp();

            await logsChan.send({ embeds: [logEmbed] }).catch(() => {});
          }

          await interaction.editReply({ content: '✅ Issue marked as **RESOLVED**! This temporary channel will permanently delete in **5 seconds**...' }).catch(() => {});
          setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
          }, 5000);
          return;
        }

        // 5. Store Buy Buttons (Creates Order Channel with UPI & UTR Submit Button)
        if (customId === 'store_order_vip' || customId === 'store_order_supreme') {
          await interaction.deferReply({ flags: 64 }).catch(() => {});
          const isSupreme = customId === 'store_order_supreme';
          const rankTitle = isSupreme ? '🔥 SUPREME VIP' : '⭐ VIP';
          const price = isSupreme ? '₹70 / month' : '₹29 / month';
          const rawAmount = isSupreme ? '₹70' : '₹29';
          const chanPrefix = isSupreme ? 'order-supreme' : 'order-vip';
          const submitBtnId = isSupreme ? 'btn_submit_utr_supreme' : 'btn_submit_utr_vip';

          const existingChannel = guild.channels.cache.find(c => c.name === `${chanPrefix}-${user.username.toLowerCase().slice(0, 10)}`);
          if (existingChannel) {
            return interaction.editReply({ content: `You already have an active order channel at <#${existingChannel.id}>!` }).catch(() => {});
          }

          const headModRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('head mod'));
          const modRole = guild.roles.cache.find(r => r.name === '🛡️ Moderator' || r.name.includes('Moderator'));

          const orderChan = await guild.channels.create({
            name: `${chanPrefix}-${user.username.toLowerCase().slice(0, 10)}`,
            type: ChannelType.GuildText,
            topic: `${rankTitle} Order Desk for ${user.tag} | UPI: ${UPI_ID}`,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
              { id: bClient.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ]
          });

          if (headModRole) await orderChan.permissionOverwrites.edit(headModRole.id, { ViewChannel: true, SendMessages: true }).catch(() => {});
          if (modRole) await orderChan.permissionOverwrites.edit(modRole.id, { ViewChannel: true, SendMessages: true }).catch(() => {});

          const amountNum = isSupreme ? 70 : 29;
          const upiUri = `upi://pay?pa=${UPI_ID}&pn=MEXXZ&am=${amountNum}&cu=INR&tn=${encodeURIComponent(`MEXVERSE SMP ${rankTitle}`)}`;
          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;

          const orderEmbed = new EmbedBuilder()
            .setTitle(`💳 ${rankTitle} Payment & Instant Activation Desk`)
            .setDescription(
              `Hello <@${user.id}>! You are acquiring the **${rankTitle}** rank on MEXVERSE SMP.\n\n` +
              `💰 **Amount to Pay:** **${rawAmount}**\n` +
              `📥 **Official UPI ID:** \`${UPI_ID}\` *(Click to copy)*\n` +
              `👑 **Recipient:** **MEXXZ (Server Owner)**\n\n` +
              `📸 **Scan the Dynamic UPI QR Code below** with **PhonePe, Google Pay, Paytm, or BHIM** — the exact amount (**${rawAmount}**) and UPI ID are pre-filled!\n\n` +
              `**⚡ Quick 3-Step Payment Instructions:**\n` +
              `1. Scan the QR code below or manually send **${rawAmount}** to **\`${UPI_ID}\`**.\n` +
              `2. After paying, check your app receipt for the **12-digit UTR / UPI Ref Number**.\n` +
              `3. Click the green button below: **[📝 Submit 12-Digit UTR]**.\n\n` +
              `*The bot will automatically dispatch your UTR to Owner MEXXZ for instant verification!*`
            )
            .addFields(
              { name: '📋 Copyable UPI ID', value: `\`\`\`\n${UPI_ID}\n\`\`\``, inline: true },
              { name: '💵 Exact Amount', value: `\`${rawAmount}\``, inline: true }
            )
            .setImage(qrCodeUrl)
            .setColor(isSupreme ? 0xEF4444 : 0x10B981)
            .setFooter({ text: 'Scan QR with PhonePe / GPay / Paytm • Automated UTR Verification' })
            .setTimestamp();

          const orderActionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(submitBtnId).setLabel('📝 Submit 12-Digit UTR').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Cancel / Close Order').setStyle(ButtonStyle.Danger)
          );

          await orderChan.send({ content: `<@${user.id}> <@${guild.ownerId}> (New Order Created!)`, embeds: [orderEmbed], components: [orderActionRow] }).catch(() => {});
          return interaction.editReply({ content: `✅ Order channel created! Head to <#${orderChan.id}> to complete payment.` }).catch(() => {});
        }

        if (customId === 'store_contact_owner') {
          return interaction.reply({
            content: `👑 To purchase a rank directly, send payment of **₹29** (VIP) or **₹70** (Supreme VIP) to UPI: **\`${UPI_ID}\`** and DM Owner **MEXXZ** (<@${guild.ownerId}>) with your UTR!`,
            flags: 64
          });
        }

        // 6. Ticket System Buttons
        if (customId.startsWith('ticket_create_')) {
          await interaction.deferReply({ flags: 64 }).catch(() => {});
          const type = customId.replace('ticket_create_', '');
          const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase().slice(0, 10)}`);
          if (existingChannel) {
            return interaction.editReply({ content: `You already have an open ticket at <#${existingChannel.id}>!` }).catch(() => {});
          }

          const typeLabels = {
            'grief': '🚨 Grief / Hacker Report',
            'rank': '💎 Rank / Store Support',
            'general': '❓ General Support'
          };

          const channel = await guild.channels.create({
            name: `ticket-${user.username.toLowerCase().slice(0, 10)}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
              { id: bClient.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ]
          });

          const headModRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('head mod'));
          const modRole = guild.roles.cache.find(r => r.name === '🛡️ Moderator' || r.name.includes('Moderator'));
          if (headModRole) await channel.permissionOverwrites.edit(headModRole.id, { ViewChannel: true, SendMessages: true }).catch(() => {});
          if (modRole) await channel.permissionOverwrites.edit(modRole.id, { ViewChannel: true, SendMessages: true }).catch(() => {});

          const tEmbed = new EmbedBuilder()
            .setTitle(`🎟️ MEXVERSE Support Ticket — ${typeLabels[type] || 'Inquiry'}`)
            .setDescription(
              `Hello <@${user.id}>! Thank you for reaching out to the **MEXVERSE SMP Staff Team**.\n\n` +
              `• Please explain your issue in detail below.\n` +
              `• If reporting griefing or theft, provide **coordinates (X, Y, Z)** and screenshots.\n` +
              `• Our <@&${headModRole ? headModRole.id : guild.ownerId}> team will assist you shortly.`
            )
            .setColor(0x00E5FF)
            .setFooter({ text: 'MEXVERSE SMP • Ticket Management' })
            .setTimestamp();

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
          );

          await channel.send({ content: `<@${user.id}> Welcome!`, embeds: [tEmbed], components: [closeRow] }).catch(() => {});
          return interaction.editReply({ content: `✅ Ticket created! Head over to <#${channel.id}>.`, flags: 64 });
        }

        if (customId === 'ticket_close') {
          await interaction.deferReply({ flags: 64 }).catch(() => {});
          await interaction.editReply({ content: '🔒 Closing this channel in 5 seconds...' }).catch(() => {});
          setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
          }, 5000);
          return;
        }

        // Self-Roles Buttons
        const roleMap = {
          'role_java': 'Java Player',
          'role_bedrock': 'Bedrock Player',
          'role_alerts': 'Server Updates'
        };

        const roleName = roleMap[customId];
        if (roleName) {
          await interaction.deferReply({ flags: 64 }).catch(() => {});
          let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
          if (!role) {
            try {
              role = await guild.roles.create({ name: roleName, reason: 'Auto-created by MEXVERSE bot for reaction roles' });
            } catch (err) {
              return interaction.editReply({ content: 'Could not create role automatically.' }).catch(() => {});
            }
          }
          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role).catch(() => {});
            return interaction.editReply({ content: `Removed the **${roleName}** role from you!` }).catch(() => {});
          } else {
            await member.roles.add(role).catch(() => {});
            return interaction.editReply({ content: `Given you the **${roleName}** role!` }).catch(() => {});
          }
        }
      }

      if (!interaction.isChatInputCommand()) return;

      const { commandName, options } = interaction;

      // ==========================================
      // 🛠️ /fix-issue (STAFF PRIVATE 1-ON-1 ISSUE SESSION)
      // ==========================================

      // ==========================================
      // 🔑 /give-crate-key (ADMIN & OWNER ONLY)
      // ==========================================
      if (commandName === 'give-crate-key') {
        await interaction.deferReply();

        const isOwner = interaction.user.id === '1551635947660247160';
        const hasAdmin = interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
        const hasHeadMod = interaction.member && interaction.member.roles.cache.some(r => r.name.toLowerCase().includes('head mod'));

        if (!isOwner && !hasAdmin && !hasHeadMod) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('⛔ Access Denied')
                .setDescription('Only **Server Owner**, **Administrators**, and **🛡️ Head Moderators** can grant in-game crate keys!')
                .setColor(0xEF4444)
            ]
          });
        }

        const crate = options.getString('crate');
        const amount = options.getInteger('amount') || 1;
        const player = options.getString('player');
        const keyAll = options.getBoolean('keyall') || false;

        if (!keyAll && !player) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('⚠️ Missing Target Player')
                .setDescription('Please specify a Minecraft player gamertag (IGN) or set `keyall: true` to give keys to everyone!')
                .setColor(0xF59E0B)
            ]
          });
        }

        let rconCmd = '';
        let targetText = '';
        if (keyAll) {
          rconCmd = `crate keyall ${crate} ${amount}`;
          targetText = '🌟 **ALL ONLINE PLAYERS** (Server-Wide Key Drop!)';
        } else {
          rconCmd = `crate give ${player} ${crate} ${amount}`;
          targetText = `🎮 Player: **${player}**`;
        }

        const rawResult = await sendMinecraftRcon(rconCmd);
        const cleanResult = (rawResult || '').replace(/§[0-9a-fk-or]/gi, '').trim();

        const crateMeta = {
          'prime_crate': { name: '🔥 Prime Crate Key', color: 0xFF4500, tier: 'God / Legendary Tier' },
          'crimson_crate': { name: '🩸 Crimson Crate Key', color: 0xDC2626, tier: 'Mythic Tier' },
          'gold_crate': { name: '💰 Gold Crate Key', color: 0xFBBF24, tier: 'Epic Tier' },
          'amethyst_crate': { name: '🔮 Amethyst Crate Key', color: 0xA855F7, tier: 'Rare Tier' },
          'common_crate': { name: '📦 Common Crate Key', color: 0x10B981, tier: 'Starter Tier' }
        }[crate] || { name: `${crate} Key`, color: 0x0284C7, tier: 'Special' };

        const receiptEmbed = new EmbedBuilder()
          .setTitle('🔑 CRATE KEYS GRANTED SUCCESSFULLY!')
          .setColor(crateMeta.color)
          .setThumbnail('https://mc-heads.net/head/MHF_Chest')
          .setDescription(`Administrator **${interaction.user.tag}** has executed an official in-game crate key grant.`)
          .addFields(
            { name: '🎯 Recipient', value: targetText, inline: true },
            { name: '📦 Crate Type', value: `${crateMeta.name}\n*(${crateMeta.tier})*`, inline: true },
            { name: '🔢 Amount', value: ```x${amount} Keys```, inline: true },
            { name: '⚡ Minecraft Console Output', value: ```${cleanResult || 'Executed successfully'}``` },
            { name: '📍 In-Game Teleport', value: 'Open and spin your keys at **`/warp crates`** in Minecraft!' }
          )
          .setFooter({ text: `MEXVERSE SMP Staff Security • Authorized by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.editReply({ embeds: [receiptEmbed] });

        // Log to #🔒┃staff-logs
        const staffLogs = guild.channels.cache.find(c => c.name.includes('staff-logs'));
        if (staffLogs) {
          await staffLogs.send({ embeds: [receiptEmbed] }).catch(() => {});
        }

        // Broadcast to announcements or in-game chat if keyall
        if (keyAll) {
          const announceChan = guild.channels.cache.find(c => c.name.includes('announcements') || c.name.includes('in-game-chat'));
          if (announceChan) {
            await announceChan.send({
              content: `🎉 @everyone **SERVER-WIDE KEY ALL DROP!**\nAdmin **${interaction.user.tag}** just dropped **x${amount} ${crateMeta.name}** to every online player! Head to /warp crates in-game to claim yours now!`
            }).catch(() => {});
          }
        }
      }

      // ==========================================
      // 📦 /crate-list
      // ==========================================
      if (commandName === 'crate-list') {
        const listEmbed = new EmbedBuilder()
          .setTitle('🎁 MEXVERSE SMP — Official Crates Matrix')
          .setColor(0x0284C7)
          .setDescription('Earn or win crate keys in-game and open them at **`/warp crates`** for enchanted armor, weapons, god apples, and rare currency!')
          .addFields(
            { name: '🔥 1. Prime Crate (Legendary Tier)', value: 'The pinnacle crate! God sets, max netherite gear, vouchers, flight tokens & rare spawners.', inline: false },
            { name: '🩸 2. Crimson Crate (Mythic Tier)', value: 'Nether-infused weaponry, high-tier armor enchants, totems & custom boss relics.', inline: false },
            { name: '💰 3. Gold Crate (Epic Tier)', value: 'Diamonds, emerald blocks, mid-tier PvP gear, experience bottles & golden apples.', inline: false },
            { name: '🔮 4. Amethyst Crate (Rare Tier)', value: 'Utility tools, potion stacks, construction supplies & claim block tokens.', inline: false },
            { name: '📦 5. Common Crate (Starter Tier)', value: 'Starter tools, iron ingots, food packs & daily survival boosters.', inline: false }
          )
          .setFooter({ text: 'MEXVERSE SMP • Type /warp crates in Minecraft to open!' })
          .setTimestamp();

        await interaction.reply({ embeds: [listEmbed] });
      }

      if (commandName === 'fix-issue') {
        const targetMember = options.getUser('member');
        const topic = options.getString('topic') || 'General Issue Resolution';
        const staffUser = interaction.user;

        await interaction.deferReply({ flags: 64 });

        const chanName = `issue-${targetMember.username.toLowerCase().slice(0, 10)}`;
        const existing = guild.channels.cache.find(c => c.name === chanName);
        if (existing) {
          return interaction.editReply({ content: `A session channel for that user already exists at <#${existing.id}>!` });
        }

        const headModRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('head mod'));

        const sessionChan = await guild.channels.create({
          name: chanName,
          type: ChannelType.GuildText,
          topic: `Private support session with ${targetMember.tag} | Opened by ${staffUser.tag}`,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: targetMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
            { id: staffUser.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles] },
            { id: bClient.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
          ]
        });

        if (headModRole) await sessionChan.permissionOverwrites.edit(headModRole.id, { ViewChannel: true, SendMessages: true }).catch(() => {});

        const sessionEmbed = new EmbedBuilder()
          .setTitle('🛠️ MEXVERSE Private Support Session')
          .setDescription(
            `Hello <@${targetMember.id}>! Staff member <@${staffUser.id}> has opened this private 1-on-1 channel to resolve your inquiry.\n\n` +
            `📋 **Topic / Subject:** *${topic}*\n\n` +
            `Please share full details, screenshots, or server coordinates below.\n` +
            `When finished, click the red button below to resolve and permanently close this session.`
          )
          .setColor(0x0284C7)
          .setFooter({ text: 'MEXVERSE SMP • Ultra-Private Staff Resolution' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('issue_resolve_close').setLabel('🔒 Resolve & Close Session').setStyle(ButtonStyle.Danger)
        );

        await sessionChan.send({ content: `<@${targetMember.id}> <@${staffUser.id}>`, embeds: [sessionEmbed], components: [row] }).catch(() => {});

        const logsChan = guild.channels.cache.find(c => c.name.includes('staff-logs'));
        if (logsChan) {
          const alertEmbed = new EmbedBuilder()
            .setTitle('🚨 Private Support Session Opened')
            .setDescription(`Staff member <@${staffUser.id}> started a private session with <@${targetMember.id}> in <#${sessionChan.id}>.\n**Topic:** *${topic}*`)
            .setColor(0x3B82F6)
            .setTimestamp();
          await logsChan.send({ embeds: [alertEmbed] }).catch(() => {});
        }

        return interaction.editReply({ content: `✅ Private session created at <#${sessionChan.id}>!` });
      }

      // ==========================================
      // 💎 /store (REAL-MONEY SHOP SHOWCASE)
      // ==========================================
      if (commandName === 'store') {
        const storeEmbed = new EmbedBuilder()
          .setTitle('💎 MEXVERSE SMP — Official Rank Store & Founder Perks')
          .setDescription(
            `Upgrade your survival journey today and unlock game-changing perks, god kits, claim flight, and death protection.\n\n` +
            `🔥 **LAUNCH SPECIAL (OVER 70% OFF):**\n` +
            `• ⭐ **VIP Rank:** **₹29 / month** *(5 Sethomes, 5,000 Claims, VIP Kit, \`/feed\`)*\n` +
            `• 🔥 **SUPREME VIP:** **₹70 / month** *(Claim Flight \`/fly\`, KEEP INVENTORY & XP SHIELD, Full Netherite Kit)*\n\n` +
            `📥 **Official Payment UPI ID:** \`${UPI_ID}\`\n\n` +
            `Click a button below to open an order channel and submit your 12-digit UTR for automatic verification!`
          )
          .setColor(0xF59E0B)
          .setImage('https://visage.surgeplay.com/bust/512/3216372b135e401ca15808f86908023c')
          .setFooter({ text: 'MEXVERSE SMP • Instant UPI Delivery' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('store_order_vip').setLabel('⭐ Buy VIP — ₹29/mo').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('store_order_supreme').setLabel('🔥 Buy SUPREME VIP — ₹70/mo').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('store_contact_owner').setLabel('👑 Message MEXXZ (Owner)').setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({ embeds: [storeEmbed], components: [row] });
      }

      // ==========================================
      // 👑 /setrole (OWNER ONLY SECURITY CHECK — INCLUDES HEAD MOD)
      // ==========================================
      if (commandName === 'setrole') {
        const isOwner = interaction.user.id === interaction.guild.ownerId;
        if (!isOwner) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('⛔ ACCESS DENIED')
                .setDescription(`Only the **Server Owner** (<@${interaction.guild.ownerId}>) has authority to assign or promote Minecraft & Staff ranks!`)
                .setColor(0xEF4444)
            ],
            flags: 64
          });
        }

        const targetUser = options.getUser('user');
        const rankChoice = options.getString('role');
        const reason = options.getString('reason') || 'Awarded by Server Owner';
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        if (!targetMember) return interaction.reply({ content: 'Member not found in server!', flags: 64 });

        const mcRoles = {
          'headmod': { name: '🛡️ Head Moderator', color: 0x0284C7, title: '[HEAD MOD]' },
          'mod': { name: '🛡️ Moderator', color: 0x00E5FF, title: '[MODERATOR]' },
          'creator': { name: '🎥 Creator', color: 0x9B59B6, title: '[CREATOR]' },
          'supreme': { name: '🔥 Supreme VIP', color: 0xFF3333, title: '[SUPREME VIP]' },
          'vip': { name: '⭐ VIP', color: 0x00FF88, title: '[VIP]' },
          'survivalist': { name: '⚔️ Survivalist', color: 0x94A3B8, title: '[SURVIVALIST]' }
        };

        const allRankRoleNames = ['🛡️ Head Moderator', '🛡️ Moderator', '🎥 Creator', '🔥 Supreme VIP', '⭐ VIP', '⚔️ Survivalist'];

        for (const rName of allRankRoleNames) {
          const existingRole = interaction.guild.roles.cache.find(r => r.name === rName);
          if (existingRole && targetMember.roles.cache.has(existingRole.id)) {
            await targetMember.roles.remove(existingRole).catch(() => {});
          }
        }

        if (rankChoice === 'remove') {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('🔄 Minecraft & Staff Ranks Reset')
                .setDescription(`All rank roles have been removed from <@${targetUser.id}> by Owner <@${interaction.user.id}>.`)
                .setColor(0x64748B)
                .setTimestamp()
            ]
          });
        }

        const selected = mcRoles[rankChoice];
        let targetRole = interaction.guild.roles.cache.find(r => r.name === selected.name);
        if (!targetRole) {
          targetRole = await interaction.guild.roles.create({
            name: selected.name,
            color: selected.color,
            hoist: true,
            mentionable: true,
            reason: 'Auto-created by MEXVERSE bot for rank hierarchy'
          });
        }

        await targetMember.roles.add(targetRole).catch(() => {});

        const promoEmbed = new EmbedBuilder()
          .setTitle(`🎉 RANK PROMOTION | MEXVERSE SMP`)
          .setDescription(
            `**Player / Staff:** <@${targetUser.id}>\n` +
            `**New Rank:** **${selected.name}** (\`${selected.title}\`)\n` +
            `**Promoted By:** <@${interaction.user.id}> (👑 Server Owner)\n` +
            `**Reason / Note:** *${reason}*\n\n` +
            `✨ Check rank perks and bonuses at https://mexverse-smp.vercel.app#ranks`
          )
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(selected.color)
          .setFooter({ text: 'MEXVERSE SMP • Official Authority' })
          .setTimestamp();

        const logsChan = interaction.guild.channels.cache.find(c => c.name.includes('staff-logs'));
        if (logsChan) {
          await logsChan.send({ embeds: [promoEmbed] }).catch(() => {});
        }

        return interaction.reply({ embeds: [promoEmbed] });
      }

      // ==========================================
      // 1. /player & /skin (3D SKINS & MINECRAFT CARDS)
      // ==========================================
      if (commandName === 'player') {
        let username = options.getString('username');
        if (!username) {
          const linked = db.getLinked(interaction.user.id);
          if (linked) username = linked.username;
          else return interaction.reply({ content: 'Please provide a Minecraft username or link your account with `/link <gamertag>`!', flags: 64 });
        }

        await interaction.deferReply();
        const player = await fetchPlayerData(username);
        const uuid = player ? player.id : 'Offline / Bedrock Player';
        const cleanName = player ? player.username : username;

        const linkedRecord = Object.entries(db.getAllLinked()).find(([uid, data]) => data.username.toLowerCase() === cleanName.toLowerCase());
        let rankText = '⚔️ Survivalist (Default)';
        let discordUserMention = 'Not Linked';
        if (linkedRecord) {
          discordUserMention = `<@${linkedRecord[0]}>`;
          const guildMember = interaction.guild.members.cache.get(linkedRecord[0]);
          if (guildMember) {
            const rankRole = guildMember.roles.cache.find(r => ['👑 Owner', '🛡️ Head Moderator', '🛡️ Moderator', '🎥 Creator', '🔥 Supreme VIP', '⭐ VIP'].includes(r.name));
            if (rankRole) rankText = `**${rankRole.name}**`;
          }
        }

        const bodyRenderUrl = `https://mc-heads.net/body/${encodeURIComponent(cleanName)}/right`;
        const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(cleanName)}/128`;

        const embed = new EmbedBuilder()
          .setTitle(`🎮 Minecraft Player Card — ${cleanName}`)
          .setDescription(`Live player dossier on **MEXVERSE SMP** realm.`)
          .setThumbnail(avatarUrl)
          .setImage(bodyRenderUrl)
          .addFields(
            { name: '🆔 Minecraft UUID', value: `\`${uuid}\``, inline: true },
            { name: '👑 Realm Rank', value: rankText, inline: true },
            { name: '💬 Discord Profile', value: discordUserMention, inline: true },
            { name: '🌐 Server Status', value: `\`${DISPLAY_JAVA_IP}\``, inline: true },
            { name: '📱 Bedrock Friendly', value: cleanName.startsWith('.') || cleanName.startsWith('*') ? 'Yes (Bedrock)' : 'Java / Crossplay', inline: true }
          )
          .setColor(0x00FF88)
          .setFooter({ text: 'MEXVERSE SMP • Live 3D Skin Render' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Download Skin 📥').setStyle(ButtonStyle.Link).setURL(`https://mc-heads.net/download/${encodeURIComponent(cleanName)}`),
          new ButtonBuilder().setLabel('NameMC Profile 🔗').setStyle(ButtonStyle.Link).setURL(`https://namemc.com/profile/${encodeURIComponent(cleanName)}`)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      if (commandName === 'skin') {
        const username = options.getString('username');
        await interaction.deferReply();

        const bodyRenderUrl = `https://mc-heads.net/body/${encodeURIComponent(username)}/right`;
        const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`;

        const embed = new EmbedBuilder()
          .setTitle(`👕 3D Skin Preview — ${username}`)
          .setDescription(`Full 3D rendered Minecraft avatar preview for **${username}**.`)
          .setImage(bodyRenderUrl)
          .setThumbnail(avatarUrl)
          .setColor(0x5865F2)
          .setFooter({ text: 'MEXVERSE SMP • mc-heads 3D render' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Download Skin 📥').setStyle(ButtonStyle.Link).setURL(`https://mc-heads.net/download/${encodeURIComponent(username)}`),
          new ButtonBuilder().setLabel('View on NameMC').setStyle(ButtonStyle.Link).setURL(`https://namemc.com/profile/${encodeURIComponent(username)}`)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      // ==========================================
      // 2. /status & /setup-status (SERVER STATUS)
      // ==========================================
      if (commandName === 'status') {
        await interaction.deferReply();
        const status = await fetchServerStatus();
        const embed = buildStatusEmbed(status);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Official Website 🌐').setStyle(ButtonStyle.Link).setURL('https://mexverse-smp.vercel.app'),
          new ButtonBuilder().setLabel('Discord Invite 💬').setStyle(ButtonStyle.Link).setURL('https://discord.gg/Z6CUm7T')
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      // ==========================================
      // 4. ECONOMY & LEVELING (/daily, /balance, /shop, /buy, /top)
      // ==========================================
      if (commandName === 'daily') {
        const eco = db.getEconomy(interaction.user.id);
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now - eco.lastDaily < ONE_DAY) {
          const remaining = ONE_DAY - (now - eco.lastDaily);
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          return interaction.reply({
            content: `⏳ You have already claimed your daily reward! Please return in **${hours}h ${minutes}m**.`,
            flags: 64
          });
        }

        eco.coins += 250;
        eco.lastDaily = now;
        db.saveEconomy();

        const embed = new EmbedBuilder()
          .setTitle('💰 Daily Bonus Claimed!')
          .setDescription(`You claimed your daily **250 MexCoins**!\n\n💳 **New Balance:** \`${eco.coins} MexCoins\``)
          .setColor(0x10B981)
          .setThumbnail('https://mc-heads.net/head/MHF_Chest')
          .setFooter({ text: 'MEXVERSE SMP • Daily Reward' });

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'balance') {
        const targetUser = options.getUser('user') || interaction.user;
        const eco = db.getEconomy(targetUser.id);

        const nextLevelXp = Math.pow((eco.level) / 0.15, 2);
        const prevLevelXp = Math.pow((eco.level - 1) / 0.15, 2);
        const progressInLevel = Math.max(0, eco.xp - prevLevelXp);
        const neededInLevel = Math.max(1, nextLevelXp - prevLevelXp);
        const percent = Math.min(100, Math.floor((progressInLevel / neededInLevel) * 100));

        const filledBars = Math.floor(percent / 10);
        const emptyBars = 10 - filledBars;
        const progressBar = '🟩'.repeat(filledBars) + '⬜'.repeat(emptyBars);

        const itemsList = eco.inventory && eco.inventory.length > 0 ? eco.inventory.map(i => `• ${i}`).join('\n') : '*No items purchased yet*';

        const embed = new EmbedBuilder()
          .setTitle(`💳 Dossier & Balance — ${targetUser.username}`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '💰 MexCoins', value: `\`${eco.coins.toLocaleString()}\` coins`, inline: true },
            { name: '⚡ Chat Level', value: `Level **${eco.level}**`, inline: true },
            { name: '✨ Total XP', value: `\`${eco.xp.toLocaleString()}\` XP`, inline: true },
            { name: `📈 Level Progress (${percent}%)`, value: `${progressBar}\n*${Math.floor(progressInLevel)} / ${Math.floor(neededInLevel)} XP to Level ${eco.level + 1}*` },
            { name: '🎒 Vault Inventory', value: itemsList }
          )
          .setColor(0xF59E0B)
          .setFooter({ text: 'MEXVERSE SMP • Chat & Earn' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'shop') {
        const embed = new EmbedBuilder()
          .setTitle('🛒 MEXVERSE Realm Shop — The MexStore')
          .setDescription('Earn MexCoins by chatting and use `/buy <item>` to acquire exclusive rewards:')
          .addFields(
            { name: '🎨 1. Custom Discord Role Color (`role_color`)', value: 'Cost: `500 MexCoins`\nPick any hex color for your personal Discord role!' },
            { name: '🔑 2. In-Game Mystery Crate Key (`crate_key`)', value: 'Cost: `1,000 MexCoins`\nVoucher redeemable in-game for an Epic Crate Key!' },
            { name: '🎟️ 3. Realm Event / Raffle Ticket (`raffle_ticket`)', value: 'Cost: `200 MexCoins`\nExtra entry in monthly giveaways and tournaments!' },
            { name: '👑 4. 25% Off VIP Rank Voucher (`vip_voucher`)', value: 'Cost: `3,000 MexCoins`\nDiscount voucher for Supporter VIP rank in realm!' }
          )
          .setColor(0x8B5CF6)
          .setFooter({ text: 'Type /buy item:<name> to purchase!' });

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'buy') {
        const itemChoice = options.getString('item');
        const eco = db.getEconomy(interaction.user.id);

        const items = {
          'role_color': { name: '🎨 Custom Role Color', cost: 500 },
          'crate_key': { name: '🔑 In-Game Mystery Crate Key', cost: 1000 },
          'raffle_ticket': { name: '🎟️ Realm Event Ticket', cost: 200 },
          'vip_voucher': { name: '👑 25% Off VIP Rank Voucher', cost: 3000 }
        };

        const selected = items[itemChoice];
        if (eco.coins < selected.cost) {
          return interaction.reply({
            content: `❌ You do not have enough MexCoins! You need **${selected.cost} MexCoins**, but you have **${eco.coins} MexCoins**. Use \`/daily\` and chat in server to earn more!`,
            flags: 64
          });
        }

        eco.coins -= selected.cost;
        eco.inventory.push(`${selected.name} (Purchased <t:${Math.floor(Date.now() / 1000)}:d>)`);
        db.saveEconomy();

        const embed = new EmbedBuilder()
          .setTitle('🎉 Purchase Successful!')
          .setDescription(`You successfully purchased **${selected.name}** for **${selected.cost} MexCoins**!\n\n💳 Remaining Balance: \`${eco.coins} MexCoins\``)
          .setColor(0x10B981);

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'top') {
        const allEco = db.getAllEconomy();
        const entries = Object.entries(allEco);

        const topCoins = [...entries].sort((a, b) => b[1].coins - a[1].coins).slice(0, 10);
        const topLevels = [...entries].sort((a, b) => b[1].xp - a[1].xp).slice(0, 10);

        const coinLeaderboard = topCoins.map((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
          return `${medal} <@${entry[0]}> — **${entry[1].coins.toLocaleString()}** MexCoins`;
        }).join('\n') || '*No records yet*';

        const levelLeaderboard = topLevels.map((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
          return `${medal} <@${entry[0]}> — Level **${entry[1].level}** (${entry[1].xp.toLocaleString()} XP)`;
        }).join('\n') || '*No records yet*';

        const embed = new EmbedBuilder()
          .setTitle('🏆 MEXVERSE SMP — Official Hall of Fame Leaderboard')
          .addFields(
            { name: '💰 Richest Realm Citizens (MexCoins)', value: coinLeaderboard },
            { name: '⚡ Highest Chat Level & Activity (XP)', value: levelLeaderboard }
          )
          .setColor(0xFBBF24)
          .setFooter({ text: 'MEXVERSE SMP • Stay active to climb the ranks!' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ==========================================
      // 5. /link & /unlink (ACCOUNT SYNC)
      // ==========================================
      if (commandName === 'link') {
        const gamertag = options.getString('gamertag');
        await interaction.deferReply();

        const player = await fetchPlayerData(gamertag);
        const cleanName = player ? player.username : gamertag;
        const uuid = player ? player.id : 'Bedrock/Crossplay';

        db.setLinked(interaction.user.id, {
          username: cleanName,
          uuid: uuid,
          linkedAt: Date.now()
        });

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member) {
          const hasRank = member.roles.cache.some(r => ['👑 Owner', '🛡️ Head Moderator', '🛡️ Moderator', '🎥 Creator', '🔥 Supreme VIP', '⭐ VIP', '⚔️ Survivalist'].includes(r.name));
          if (!hasRank) {
            let survRole = interaction.guild.roles.cache.find(r => r.name.includes('Survivalist'));
            if (survRole) await member.roles.add(survRole).catch(() => {});
          }
        }

        const bodyRenderUrl = `https://mc-heads.net/body/${encodeURIComponent(cleanName)}/right`;
        const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(cleanName)}/128`;

        const embed = new EmbedBuilder()
          .setTitle('🔗 Minecraft Account Successfully Linked!')
          .setDescription(`Your Discord profile is now paired with Minecraft player **${cleanName}**!`)
          .setThumbnail(avatarUrl)
          .setImage(bodyRenderUrl)
          .addFields(
            { name: '🎮 Minecraft Gamertag', value: `\`${cleanName}\``, inline: true },
            { name: '🆔 UUID', value: `\`${uuid}\``, inline: true },
            { name: '⚔️ Rank Sync', value: 'Synchronized with realm roles', inline: true }
          )
          .setColor(0x00FF88)
          .setFooter({ text: 'MEXVERSE SMP • Account Link System' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (commandName === 'unlink') {
        db.removeLinked(interaction.user.id);
        return interaction.reply({ content: '✅ Your Minecraft account has been unlinked from Discord.', flags: 64 });
      }

      // ==========================================
      // 7. /broadcast-event (BOSS & REALM EVENTS)
      // ==========================================
      if (commandName === 'broadcast-event') {
        const type = options.getString('type');
        const player = options.getString('player');
        const details = options.getString('details') || '';

        const titles = {
          'dragon': '🐉 MYTHIC ACHIEVEMENT: ENDER DRAGON SLAIN!',
          'wither': '💀 WITHER BOSS DEFEATED!',
          'tournament': '⚔️ REALM TOURNAMENT ANNOUNCEMENT!',
          'death': '💀 REALM CASUALTY: EPIC DEATH ALERT!'
        };

        const colors = {
          'dragon': 0x9333EA,
          'wither': 0x1E293B,
          'tournament': 0xF59E0B,
          'death': 0xEF4444
        };

        const embed = new EmbedBuilder()
          .setTitle(titles[type] || '📢 REALM BROADCAST')
          .setDescription(
            `**Warrior / Player:** **${player}**\n` +
            `**Broadcast Details:** ${details || 'A legendary event has been recorded in MEXVERSE SMP!'}\n\n` +
            `🌐 **Join the realm:** \`${DISPLAY_JAVA_IP}\``
          )
          .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(player)}/128`)
          .setColor(colors[type] || 0x5865F2)
          .setFooter({ text: `Broadcasted by ${interaction.user.username} • MEXVERSE Staff` })
          .setTimestamp();

        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({ content: 'Event broadcasted to channel!', flags: 64 });
      }

      // ==========================================
      // MODERATION & GENERAL COMMANDS
      // ==========================================
      if (commandName === 'clear') {
        const amount = options.getInteger('amount');
        const messages = await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `🧹 Deleted **${messages.size}** messages!`, flags: 64 });
      }

      if (commandName === 'kick') {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);
        if (!member) return interaction.reply({ content: 'User not found in server!', flags: 64 });
        if (!member.kickable) return interaction.reply({ content: 'I cannot kick this member.', flags: 64 });

        await member.kick(reason);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('👢 Member Kicked')
              .setDescription(`**Target:** ${target.tag}\n**Moderator:** <@${interaction.user.id}>\n**Reason:** ${reason}`)
              .setColor(0xE02424)
              .setTimestamp()
          ]
        });
      }

      if (commandName === 'ban') {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);
        if (member && !member.bannable) return interaction.reply({ content: 'I cannot ban this member.', flags: 64 });

        await interaction.guild.members.ban(target.id, { reason });
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔨 Member Banned')
              .setDescription(`**Target:** ${target.tag}\n**Moderator:** <@${interaction.user.id}>\n**Reason:** ${reason}`)
              .setColor(0x991B1B)
              .setTimestamp()
          ]
        });
      }

      if (commandName === 'timeout') {
        const target = options.getUser('user');
        const minutes = options.getInteger('minutes');
        const reason = options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);
        if (!member) return interaction.reply({ content: 'User not found!', flags: 64 });

        await member.timeout(minutes * 60 * 1000, reason);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏳ Member Timed Out')
              .setDescription(`**Target:** ${target.tag}\n**Duration:** ${minutes} minutes\n**Reason:** ${reason}`)
              .setColor(0xD97706)
              .setTimestamp()
          ]
        });
      }

      if (commandName === 'warn') {
        const target = options.getUser('user');
        const reason = options.getString('reason');

        const embed = new EmbedBuilder()
          .setTitle('⚠️ Formal Warning Issued')
          .setDescription(`**User:** <@${target.id}>\n**Moderator:** <@${interaction.user.id}>\n**Reason:** ${reason}`)
          .setColor(0xFBBF24)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        try {
          await target.send({ content: `You received a warning in **${interaction.guild.name}** for: **${reason}**` });
        } catch (e) {}
      }

      if (commandName === 'poll') {
        const question = options.getString('question');
        const opt1 = options.getString('opt1');
        const opt2 = options.getString('opt2');
        const opt3 = options.getString('opt3');
        const opt4 = options.getString('opt4');

        let desc = `**${question}**\n\n1️⃣ ${opt1}\n2️⃣ ${opt2}`;
        if (opt3) desc += `\n3️⃣ ${opt3}`;
        if (opt4) desc += `\n4️⃣ ${opt4}`;

        const embed = new EmbedBuilder()
          .setTitle('📊 Community Poll')
          .setDescription(desc)
          .setColor(0x06B6D4)
          .setFooter({ text: `Poll created by ${interaction.user.username}` })
          .setTimestamp();

        const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
        await reply.react('1️⃣');
        await reply.react('2️⃣');
        if (opt3) await reply.react('3️⃣');
        if (opt4) await reply.react('4️⃣');
      }

      if (commandName === 'announce') {
        const channel = options.getChannel('channel');
        const title = options.getString('title');
        const message = options.getString('message');

        const embed = new EmbedBuilder()
          .setTitle(`📢 ${title}`)
          .setDescription(message)
          .setColor(0xEF4444)
          .setFooter({ text: `Announced by ${interaction.user.username} • MEXVERSE SMP` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: `Announcement posted to <#${channel.id}>!`, flags: 64 });
      }

      if (commandName === 'serverinfo') {
        const g = interaction.guild;
        const embed = new EmbedBuilder()
          .setTitle(`ℹ️ ${g.name} — Server Statistics`)
          .setThumbnail(g.iconURL({ dynamic: true }))
          .addFields(
            { name: '👥 Total Members', value: `${g.memberCount}`, inline: true },
            { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
            { name: '📅 Created On', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
            { name: '💬 Channels', value: `${g.channels.cache.size}`, inline: true },
            { name: '🎭 Roles', value: `${g.roles.cache.size}`, inline: true },
            { name: '🌐 Server IP', value: `\`${DISPLAY_JAVA_IP}\``, inline: true }
          )
          .setColor(0x5865F2)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'userinfo') {
        const target = options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(target.id);
        const linked = db.getLinked(target.id);

        const embed = new EmbedBuilder()
          .setTitle(`👤 Profile — ${target.tag}`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🆔 User ID', value: target.id, inline: true },
            { name: '🎮 Linked Minecraft', value: linked ? `**${linked.username}** (\`${linked.uuid}\`)` : '*Not linked*', inline: true },
            { name: '📅 Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
            { name: '🎭 Roles', value: member ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => `<@&${r.id}>`).join(' ') || 'None' : 'None' }
          )
          .setColor(0x10B981)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'ip') {
        const embed = new EmbedBuilder()
          .setTitle('⚔️ MEXVERSE SMP — Connection Details')
          .setDescription(
            '**🖥️ Java Edition:**\n' +
            `• Server IP: \`${DISPLAY_JAVA_IP}\`\n` +
            `• Tunnel Fallback: \`${JAVA_IP}\`\n\n` +
            '**📱 Bedrock Edition (PE / Consoles):**\n' +
            `• Server IP: \`${BEDROCK_IP}\`\n` +
            `• Port: \`${BEDROCK_PORT}\`\n\n` +
            '🌐 **Live Website:** https://mexverse-smp.vercel.app\n' +
            '🎁 Claim free kit: `/kit starter`'
          )
          .setColor(0x10B981)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'ranks') {
        const embed = new EmbedBuilder()
          .setTitle('👑 MEXVERSE SMP — Official Rank Benefits & Titles')
          .setDescription('Privileges, perks, and kits for every role in the realm:')
          .addFields(
            {
              name: '👑 1. [OWNER] — MEXXZ (Founder & Supreme Sovereign)',
              value:
                '• Master Console & OP Authority\n' +
                '• Total Land Claim Administration & Event Controls\n' +
                '• Permanent Center Gold Stage in Realm Hall of Fame'
            },
            {
              name: '🛡️ 2. [HEAD MODERATOR] — Senior Staff Authority',
              value:
                '• Senior Ticket & Player Dispute Arbitrator\n' +
                '• `/fix-issue` 1-on-1 private session leadership\n' +
                '• Staff logs inspection, audit oversight & announcements'
            },
            {
              name: '🛡️ 3. [MODERATOR] — Staff Guardian',
              value:
                '• Inspection & Rollback (`/co i`, `/co rollback`)\n' +
                '• Moderation Toolkit (`/mute`, `/kick`, `/warn`, `/freeze`)\n' +
                '• Stealth Patrol (`/vanish`, `/spec`) & Staff Ticket access'
            },
            {
              name: '🎥 4. [CREATOR] — Content Partner',
              value:
                '• Vibrant Magenta/Purple Prefix `&d[CREATOR]`\n' +
                '• `/stream` & `/record` broadcast permissions\n' +
                '• Monthly Creator Crate Keys & Media Link perks\n' +
                '• 8 Sethomes & 8,000 Land Claim Blocks'
            },
            {
              name: '🔥 5. [SUPREME VIP] — Ultimate Player Rank (`₹70/mo`)',
              value:
                '• 15 Sethomes & 15,000 Land Claim Blocks\n' +
                '• **CLAIM FLIGHT (`/fly`)** & **ZERO LOSS ON DEATH SHIELD**\n' +
                '• Supreme Mythic Kit (`/kit supreme`) + `/ec`, `/anvil`\n' +
                '• 2x Economy & Auction House multipliers'
            },
            {
              name: '⭐ 6. [VIP] — Supporter Rank (`₹29/mo`)',
              value:
                '• 5 Sethomes & 5,000 Claim Blocks\n' +
                '• VIP Daily Kit (`/kit vip`) & Utility (`/feed`, `/workbench`)\n' +
                '• Server Queue Skip & AFK Immunity'
            },
            {
              name: '⚔️ 7. [SURVIVALIST] — Default Member Tier',
              value:
                '• 1 Sethome & 500 Land Claim Blocks\n' +
                '• Starter Kit (`/kit starter`) & Auction House (`/ah`)'
            }
          )
          .setColor(0xF59E0B)
          .setFooter({ text: 'MEXVERSE SMP • View online at https://mexverse-smp.vercel.app#ranks' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'rules') {
        const embed = new EmbedBuilder()
          .setTitle('📜 MEXVERSE SMP — Official Realm Rules')
          .setDescription(
            '1. **No Griefing or Stealing:** Protect your bases with `/claim`.\n' +
            '2. **No Hacking or Cheating:** X-ray, flight, auto-clickers = instant ban.\n' +
            '3. **Respect All Members:** Toxicity and harassment will not be tolerated.\n' +
            '4. **No Spam or Ads:** Keep chat clean.\n' +
            '5. **Staff Decisions are Final:** Respect decisions made by MEXXZ & Moderators.'
          )
          .setColor(0xEF4444)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    } catch (cmdErr) {
      console.error('[INTERACTION ERROR]', cmdErr);
    }
  });
}

function buildStatusEmbed(status) {
  if (status && status.online) {
    const playersOnline = status.players?.online || 0;
    const playersMax = status.players?.max || 50;
    const playerList = status.players?.list && status.players.list.length > 0
      ? status.players.list.map(p => `• \`${p}\``).join(', ')
      : '*No warriors currently online*';

    return new EmbedBuilder()
      .setTitle('🟢 MEXVERSE SMP — Live Realm Status')
      .setDescription('Realm is currently **ONLINE** and open for crossplay connections!')
      .addFields(
        { name: '👥 Warriors Online', value: `**${playersOnline} / ${playersMax}**`, inline: true },
        { name: '⚡ Realm Ping', value: '`~18ms` (Ultra Low Latency)', inline: true },
        { name: '📦 Engine / Version', value: `\`${status.version || 'Paper/Purpur 1.20+'}\``, inline: true },
        { name: '🖥️ Java Server IP', value: `\`${DISPLAY_JAVA_IP}\``, inline: true },
        { name: '📱 Bedrock Server IP', value: `\`${BEDROCK_IP}:${BEDROCK_PORT}\``, inline: true },
        { name: '🛡️ Online Players', value: playerList }
      )
      .setColor(0x00FF88)
      .setFooter({ text: 'Auto-updates every 2 minutes • MEXVERSE SMP' })
      .setTimestamp();
  } else {
    return new EmbedBuilder()
      .setTitle('🔴 MEXVERSE SMP — Live Realm Status')
      .setDescription(
        'The server is currently **RESTARTING** or offline for maintenance.\n\n' +
        '• Stay tuned in <#1570435509371670588> for uptime notifications.\n' +
        `• Direct Connect: \`${DISPLAY_JAVA_IP}\``
      )
      .setColor(0xEF4444)
      .setFooter({ text: 'Auto-updates every 2 minutes • MEXVERSE SMP' })
      .setTimestamp();
  }
}

// Start bot
setupBotHandlers(client);

client.login(TOKEN).catch(err => {
  if (err.message && err.message.includes('disallowed intents')) {
    console.log('[INTENTS WARNING] Privileged intents not toggled in portal. Falling back to basic intents...');
    client = createClient(false);
    setupBotHandlers(client);
    client.login(TOKEN);
  } else {
    console.error('Fatal login error:', err);
  }
});
