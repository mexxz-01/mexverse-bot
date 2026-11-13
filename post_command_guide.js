const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const path = require('path');
const fs = require('fs');

try {
  if (process.loadEnvFile) {
    process.loadEnvFile(path.join(__dirname, '.env'));
  } else {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').trim();
      }
    }
  }
} catch (e) {}

const BOT_COMMANDS_CHANNEL_ID = '1570455798625083553';
const TICKET_CHANNEL_ID = '1570455855143325796';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log(`[GUIDE POSTER] Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(BOT_COMMANDS_CHANNEL_ID);
    if (!channel) {
      console.error(`Channel ${BOT_COMMANDS_CHANNEL_ID} not found!`);
      process.exit(1);
    }

    console.log(`Target channel found: #${channel.name}`);

    // Clean previous bot messages in this channel to keep it neat if desired
    try {
      const messages = await channel.messages.fetch({ limit: 20 });
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      if (botMessages.size > 0) {
        console.log(`Clearing ${botMessages.size} previous bot messages for clean presentation...`);
        for (const msg of botMessages.values()) {
          await msg.delete().catch(() => {});
        }
      }
    } catch (e) {
      console.log('Notice: Could not bulk clean previous messages, proceeding to send new guide.');
    }

    // Embed 1: Header / Overview
    const headerEmbed = new EmbedBuilder()
      .setTitle('⚡ MEXVERSE SMP — Official Bot Commands Directory')
      .setDescription(
        'Welcome to the **MEXVERSE SMP** command center! All server members have access to the commands below.\n' +
        'Simply type `/` followed by the command name anywhere or right here in <#' + BOT_COMMANDS_CHANNEL_ID + '>.'
      )
      .setColor(0x00FF88)
      .setImage('https://dummyimage.com/1200x200/0f172a/00ff88&text=MEXVERSE+SMP+%E2%80%A2+PLAYER+COMMANDS+HUB')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'MEXVERSE Guardian Bot • Type / in chat to begin' });

    // Embed 2: Core Commands Categorized
    const guideEmbed = new EmbedBuilder()
      .setTitle('📜 Complete Directory of Player Commands')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '🎮 1. Minecraft Identity & 3D Skin Renders',
          value:
            '• </player:0> `[username]` — View a player\'s 3D skin render, UUID, realm rank, and linked Discord.\n' +
            '• </skin:0> `<username>` — Render a full 3D body preview, face avatar, and get a 1-click `.png` download link.\n' +
            '• </link:0> `<gamertag>` — Link your Minecraft gamertag to your Discord profile to sync perks.\n' +
            '• </unlink:0> — Unlink your registered Minecraft gamertag.'
        },
        {
          name: '💰 2. Economy, Levels & MexStore',
          value:
            '• </daily:0> — Claim your daily **+250 MexCoins** and bonus XP! (Available every 24h)\n' +
            '• </balance:0> `[user]` — Check coin balance, chat level, XP progress bar, and vault inventory.\n' +
            '• </shop:0> — Browse items available for purchase with MexCoins (Role colors, Crate keys, VIP vouchers).\n' +
            '• </buy:0> `<item>` — Spend your MexCoins to purchase items from the MexStore.\n' +
            '• </top:0> — View the Realm Hall of Fame (richest players and highest chat level grinders).'
        },
        {
          name: '🌐 3. Server Info, IPs & Rules',
          value:
            '• </ip:0> — Instant connection info for both **Java** (`mexverse.qd.je`) and **Bedrock** (Port `22938`).\n' +
            '• </serverinfo:0> — Live statistics for the Discord guild, member counts, and booster status.\n' +
            '• </userinfo:0> `[user]` — Display Discord profile overview, creation date, and assigned roles.\n' +
            '• </rules:0> — Read the official rules to stay safe and avoid bans.'
        },
        {
          name: '🎁 4. Crates, VIP Ranks & Smart UPI Purchase',
          value:
            '• </crate-list:0> — View all 5 Crate tiers (*Prime, Crimson, Gold, Amethyst, Common*) and their rewards.\n' +
            '• </ranks:0> — See complete breakdown of **VIP** (₹29) and **Supreme VIP** (₹70) perks, commands & kits.\n' +
            '• </store:0> — Get the direct link to the realm store and UPI payment modal.\n' +
            '• </redeem-purchase:0> — Submit your 12-digit UPI UTR for instant automatic rank & crate key activation!\n' +
            '• </pay:0> `<user>` `<amount>` — Transfer MexCoins to any other member with 0% fee.'
        },
        {
          name: '⚔️ 5. In-Game Realm Feed, PvP Bounties & Playtime',
          value:
            '• </bounty:0> `<player>` `<coins>` — Place a MexCoin bounty on an enemy\'s head! Announce to <#1570725040486355047>.\n' +
            '• </bounties:0> — View all active wanted player bounties in the realm.\n' +
            '• </playtime:0> `[username]` — Track in-game hours and milestone progress to **Novice (5h+)**, **Veteran (25h+)**, and **No-Life Grinder (100h+)**!\n' +
            '• Watch <#1570725040486355047> for live death announcements, kill feeds, and rare achievements!'
        },
        {
          name: '🎟️ 6. Support & Assistance',
          value:
            '• </ticket:0> — Open a private support channel with the staff team.\n' +
            '• Or visit <#' + TICKET_CHANNEL_ID + '> to open a ticket directly with one click.'
        }
      )
      .setFooter({ text: 'MEXVERSE SMP • Version 1.21.11 • Crossplay Enabled', iconURL: 'https://mc-heads.net/head/MHF_Chest' })
      .setTimestamp();

    // Quick Action Buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🌐 Connect to Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://mexverse-smp.vercel.app'),
      new ButtonBuilder()
        .setLabel('💎 Realm Store')
        .setStyle(ButtonStyle.Link)
        .setURL('https://mexverse-smp.vercel.app/#store'),
      new ButtonBuilder()
        .setLabel('🎫 Open Ticket')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.com/channels/1570430997999263895/1570435967008112702')
    );

    const sent = await channel.send({
      embeds: [headerEmbed, guideEmbed],
      components: [row]
    });

    console.log(`[SUCCESS] Command guide sent successfully! Message ID: ${sent.id}`);
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Failed to send guide:', error);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
