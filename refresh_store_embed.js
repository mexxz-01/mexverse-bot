try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch(e) {}
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const TOKEN = 'process.env.DISCORD_TOKEN';
const GUILD_ID = '1570430997999263895';
const UPI_ID = 'mexxz@slc';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) process.exit(1);

  const storeChan = guild.channels.cache.find(c => c.name.includes('realm-store'));
  if (storeChan) {
    // Purge old messages
    const msgs = await storeChan.messages.fetch({ limit: 10 }).catch(() => null);
    if (msgs && msgs.size > 0) {
      for (const [id, msg] of msgs) {
        await msg.delete().catch(() => {});
      }
    }

    const storeEmbed = new EmbedBuilder()
      .setTitle('💎 MEXVERSE SMP — Official Rank Store & Founder Perks')
      .setDescription(
        `Welcome to the **MEXVERSE SMP Official Realm Store**!\n` +
        `Upgrade your survival journey today and unlock game-changing perks, god kits, claim flight, and death protection.\n\n` +
        `🔥 **LIMITED FOUNDER LAUNCH OFFER (OVER 70% OFF):**\n` +
        `Standard SMP ranks sell for ₹199+, but you can secure early supporter pricing starting at **just ₹29/month** *(less than a cup of chai/coffee!)*\n` +
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
          name: '💳 Payment via UPI & Automated UTR Verification',
          value:
            `📥 **Official UPI ID:** \`${UPI_ID}\` *(Click to copy)*\n` +
            `👑 **Payee Name:** **MEXXZ (Owner)**\n\n` +
            `**⚡ Simple 3-Step Ordering Process:**\n` +
            `1. Click **[⭐ Buy VIP — ₹29]** or **[🔥 Buy SUPREME VIP — ₹70]** below to open your private order desk.\n` +
            `2. Send payment to UPI ID: **\`${UPI_ID}\`** via PhonePe, GPay, Paytm, or BHIM.\n` +
            `3. Click **[📝 Submit 12-Digit UTR]** in your order channel — the bot will automatically notify Owner **MEXXZ** for instant verification!`
        }
      )
      .setColor(0xF59E0B)
      .setImage('https://visage.surgeplay.com/bust/512/3216372b135e401ca15808f86908023c')
      .setFooter({ text: 'MEXVERSE SMP • 100% Secure UPI Payments • Automated UTR Verification' })
      .setTimestamp();

    const storeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('store_order_vip').setLabel('⭐ Buy VIP — ₹29/mo').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('store_order_supreme').setLabel('🔥 Buy SUPREME VIP — ₹70/mo').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('store_contact_owner').setLabel('👑 Message MEXXZ (Owner)').setStyle(ButtonStyle.Primary)
    );

    await storeChan.send({ embeds: [storeEmbed], components: [storeRow] });
    console.log('[STORE] Successfully refreshed #💎┃realm-store with UPI mexxz@slc and UTR instructions!');
  }
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
