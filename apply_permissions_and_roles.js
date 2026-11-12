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

const TOKEN = 'process.env.DISCORD_TOKEN';
const GUILD_ID = '1570430997999263895';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', async () => {
  console.log('[PERMS & ROLES] Connected as ' + client.user.tag);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  // 1. Create Head Moderator Role if missing
  let headModRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('head mod'));
  if (!headModRole) {
    headModRole = await guild.roles.create({
      name: '🛡️ Head Moderator',
      color: 0x0284C7, // Vibrant Electric Blue
      hoist: true,
      mentionable: true,
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.ManageChannels
      ],
      reason: 'Created Head Moderator role'
    });
    console.log('[ROLES] Created 🛡️ Head Moderator role');
  }

  const modRole = guild.roles.cache.find(r => r.name === '🛡️ Moderator' || r.name.includes('Moderator'));
  const ownerId = guild.ownerId;

  // 2. Create Staff Logs Channel if missing
  const staffCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('STAFF HQ'));
  if (staffCat) {
    let logsChan = guild.channels.cache.find(c => c.name.includes('staff-logs'));
    if (!logsChan) {
      logsChan = await guild.channels.create({
        name: '🔒┃staff-logs',
        type: ChannelType.GuildText,
        parent: staffCat.id,
        topic: '📋 Official resolution logs, issue transcripts, and staff audit reports',
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
        ]
      });
      if (headModRole) await logsChan.permissionOverwrites.edit(headModRole.id, { ViewChannel: true, SendMessages: false });
      if (modRole) await logsChan.permissionOverwrites.edit(modRole.id, { ViewChannel: true, SendMessages: false });
      console.log('[STAFF HQ] Created #🔒┃staff-logs channel');
    }
  }

  // 3. Create #💎┃realm-store Channel under Information category
  const infoCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('INFORMATION'));
  let storeChan = guild.channels.cache.find(c => c.name.includes('realm-store') || c.name.includes('shop'));
  if (!storeChan) {
    storeChan = await guild.channels.create({
      name: '💎┃realm-store',
      type: ChannelType.GuildText,
      parent: infoCat ? infoCat.id : null,
      topic: '💎 Official MEXVERSE SMP Store — VIP & Supreme VIP Rank Perks & UPI Instant Activation',
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
        { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] }
      ]
    });
    console.log('[STORE] Created #💎┃realm-store channel');
  }

  // Deploy High-Converting Store Showcase Embed with Marketing Psychology
  const storeEmbed = new EmbedBuilder()
    .setTitle('💎 MEXVERSE SMP — Official Rank Store & Founder Perks')
    .setDescription(
      `Welcome to the **MEXVERSE SMP Official Realm Store**!\n` +
      `Upgrade your survival journey today and unlock game-changing perks, god kits, claim flight, and death protection.\n\n` +
      `🔥 **LIMITED FOUNDER LAUNCH OFFER (SAVE OVER 70%):**\n` +
      `Standard server ranks cost ₹199+, but you can secure early supporter pricing starting at **just ₹29/month** *(less than a cup of chai/coffee!)*\n` +
      `────────────────────────────────────────`
    )
    .addFields(
      {
        name: '⭐ 1. VIP RANK — Supporter Tier (`₹29 / month`)',
        value:
          '**The Essential Explorer Upgrade**\n' +
          '• 🟢 **Vibrant Green Chat Prefix:** `[VIP] Player`\n' +
          '• 🏠 **5 Sethomes** (`/sethome`) across Overworld & Nether\n' +
          '• 🛡️ **5,000 Land Claim Blocks** for big kingdom plots\n' +
          '• 🎁 **VIP Daily Kit (`/kit vip`):** Enchanted Diamond Gear & Supplies\n' +
          '• 🍔 **Utility Perks:** `/feed` (Instant hunger restore) & `/workbench`\n' +
          '• ⚡ **Priority Queue Skip** & AFK Kick Immunity\n' +
          '• 🥉 Bronze Stage Statue in Realm Hall of Fame\n' +
          '👉 *Best for active survivalists who want extra homes & claim space!*'
      },
      {
        name: '🔥 2. SUPREME VIP — The Ultimate Sovereign Tier (`₹70 / month`)',
        value:
          '**The God-Tier Experience — Maximum Power & Security**\n' +
          '• 🟡 **Legendary Golden Flare Prefix:** `[SUPREME VIP] Player`\n' +
          '• 🛡️ **KEEP INVENTORY & XP SHIELD:** **Never lose your items or levels on death!** (Zero risk in lava/void)\n' +
          '• 🪽 **CLAIM FLIGHT PRIVILEGE:** Fly freely inside your claims with `/fly`!\n' +
          '• 🏰 **15 Sethomes** & **15,000 Land Claim Blocks** for mega empires\n' +
          '• ⚔️ **Supreme Mythic Kit (`/kit supreme`):** Full Netherite Gear & Enchanted Golden Apples\n' +
          '• 🧰 **Portable Stations:** `/ec` (Enderchest anywhere), `/anvil`, `/smithing`\n' +
          '• 💰 **2x Economy & Auction House Multipliers**\n' +
          '• 🥇 Permanent Center Golden Stage Statue in Realm Hall of Fame\n' +
          '👉 *The top-selling choice: Fly, keep all your gear, and rule the realm!*'
      },
      {
        name: '💳 How to Order & Instant Activation',
        value:
          '1. Click either **[⭐ Buy VIP — ₹29]** or **[🔥 Buy SUPREME VIP — ₹70]** below.\n' +
          '2. An **instant private order ticket** will be created with Owner **MEXXZ**.\n' +
          '3. Pay seamlessly via **UPI, PhonePe, Google Pay, or Paytm**.\n' +
          '4. Your Discord & in-game Minecraft rank will be activated within minutes!'
      }
    )
    .setColor(0xF59E0B)
    .setImage('https://visage.surgeplay.com/bust/512/3216372b135e401ca15808f86908023c')
    .setFooter({ text: 'MEXVERSE SMP • 100% Secure Payments • Instant Delivery' })
    .setTimestamp();

  const storeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('store_order_vip').setLabel('⭐ Buy VIP — ₹29/mo').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('store_order_supreme').setLabel('🔥 Buy SUPREME VIP — ₹70/mo').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('store_contact_owner').setLabel('👑 Message MEXXZ (Owner)').setStyle(ButtonStyle.Primary)
  );

  await storeChan.send({ embeds: [storeEmbed], components: [storeRow] });
  console.log('[STORE] Deployed Store Showcase Embed into #💎┃realm-store');

  // 4. Wisely enforce all channel permissions
  console.log('[PERMS] Enforcing channel permissions wisely across all channels...');

  // Announcements: ONLY Bot and Owner can send messages
  const annChan = guild.channels.cache.find(c => c.name.includes('announcement'));
  if (annChan) {
    await annChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.MentionEveryone] }
    ]);
    if (headModRole) await annChan.permissionOverwrites.edit(headModRole.id, { SendMessages: true });
    console.log('[PERMS] #announcements locked to Owner, Head Mod & Bot');
  }

  // Rules: Read-only
  const rulesChan = guild.channels.cache.find(c => c.name.includes('rules'));
  if (rulesChan) {
    await rulesChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);
    console.log('[PERMS] #rules-and-faq locked to Read-Only');
  }

  // Server IP: Read-only
  const ipChan = guild.channels.cache.find(c => c.name.includes('server-ip'));
  if (ipChan) {
    await ipChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);
    console.log('[PERMS] #server-ip locked to Read-Only');
  }

  // Select Roles: Read-only
  const rolesChan = guild.channels.cache.find(c => c.name.includes('select-roles'));
  if (rolesChan) {
    await rolesChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);
    console.log('[PERMS] #select-roles locked to Read-Only');
  }

  // Server Status: Read-only
  const statusChan = guild.channels.cache.find(c => c.name.includes('server-status'));
  if (statusChan) {
    await statusChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);
    console.log('[PERMS] #server-status locked to Read-Only');
  }

  // Open a Ticket: Read-only (buttons only)
  const ticketChan = guild.channels.cache.find(c => c.name.includes('open-a-ticket'));
  if (ticketChan) {
    await ticketChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);
    console.log('[PERMS] #open-a-ticket locked to Read-Only');
  }

  // Hall of Fame: Read-only with reactions
  const hallChan = guild.channels.cache.find(c => c.name.includes('hall-of-fame'));
  if (hallChan) {
    await hallChan.permissionOverwrites.set([
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);
    console.log('[PERMS] #hall-of-fame locked to Bot Post + Member Reactions');
  }

  console.log('[PERMS & ROLES] All permissions and roles successfully applied!');
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
