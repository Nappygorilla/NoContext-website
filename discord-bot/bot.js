const http = require('http');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
const API_BASE_URL = String(process.env.NOCONTEXT_API_URL || process.env.WEBSITE_BASE_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');
const BOT_SECRET = process.env.DISCORD_BOT_SECRET || '';
const TICKET_CHANNEL_ID = String(process.env.DISCORD_TICKET_CHANNEL_ID || '').trim();
const TICKET_CATEGORY_ID = String(process.env.DISCORD_TICKET_CATEGORY_ID || process.env.TICKET_CATEGORY_ID || '').trim();
const STAFF_ROLE_ID = String(process.env.AUTHORIZED_ROLE_ID || '').trim();
const ADMIN_IDS = new Set(String(process.env.DISCORD_ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean));
const WEBSITE_ADMIN_ID = String(process.env.WEBSITE_ADMIN_ID || '').trim();
if (WEBSITE_ADMIN_ID) ADMIN_IDS.add(WEBSITE_ADMIN_ID);

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing Discord bot token or client ID environment variable.');
  process.exit(1);
}

const adminCommandNames = ['createkey','revokekey','extendkey','keyinfo','keys','createapikey','revokeapikey','apikeyinfo'];
const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Check NoContext API status.'),
  new SlashCommandBuilder().setName('validate').setDescription('Validate a NoContext license key.')
    .addStringOption(o => o.setName('key').setDescription('License key').setRequired(true))
    .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(false)),
  new SlashCommandBuilder().setName('ticket').setDescription('Open a support ticket linked to the NoContext website.'),
  new SlashCommandBuilder().setName('createkey').setDescription('Create a NoContext license key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('duration').setDescription('License duration').setRequired(true).addChoices({name:'3 days',value:'3d'},{name:'7 days',value:'7d'},{name:'Lifetime',value:'lifetime'}))
    .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(false))
    .addIntegerOption(o => o.setName('user_id').setDescription('Website user ID').setRequired(false)),
  new SlashCommandBuilder().setName('revokekey').setDescription('Revoke a NoContext license key by ID.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('id').setDescription('License ID').setRequired(true)),
  new SlashCommandBuilder().setName('extendkey').setDescription('Extend a NoContext license key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('id').setDescription('License ID').setRequired(true))
    .addIntegerOption(o => o.setName('days').setDescription('Days to add').setRequired(true).setMinValue(1).setMaxValue(3650)),
  new SlashCommandBuilder().setName('keyinfo').setDescription('Show NoContext license information.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('id').setDescription('License ID').setRequired(true)),
  new SlashCommandBuilder().setName('keys').setDescription('List NoContext license keys.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('createapikey').setDescription('Create a developer API key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('API key name').setRequired(false)),
  new SlashCommandBuilder().setName('revokeapikey').setDescription('Revoke a developer API key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('id').setDescription('API key ID').setRequired(true)),
  new SlashCommandBuilder().setName('apikeyinfo').setDescription('Show developer API key information.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('id').setDescription('API key ID').setRequired(true)),
  new SlashCommandBuilder().setName('info').setDescription('Show NoContext bot information.'),
  new SlashCommandBuilder().setName('help').setDescription('Show NoContext bot commands.'),
].map(c => c.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ticketSyncCursors = new Map();

function startHealthServer() {
  const port = Number(process.env.PORT || 10000);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'NoContext Discord Bot', status: 'online' }));
  });
  server.listen(port, '0.0.0.0', () => console.log(`Render health server listening on ${port}`));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(BOT_SECRET ? { 'X-Discord-Bot-Secret': BOT_SECRET } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  return data;
}

async function adminApiRequest(path, options, interaction) {
  return apiRequest(path, {
    ...options,
    headers: { ...(options?.headers || {}), 'X-Discord-User-ID': interaction.user.id },
  });
}

function requireAdmin(interaction) {
  if (ADMIN_IDS.size === 0) throw new Error('No Discord admin IDs are configured.');
  if (!ADMIN_IDS.has(interaction.user.id)) throw new Error('You are not authorized to use this command.');
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `<t:${Math.floor(date.getTime()/1000)}:f>`;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  else await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`Registered ${commands.length} Discord commands.`);
}

async function createWebsiteTicket(interaction) {
  const data = await apiRequest('/api/discord/tickets', {
    method: 'POST',
    body: JSON.stringify({
      discord_id: interaction.user.id,
      discord_username: interaction.user.tag,
      subject: `Discord Support · ${interaction.user.username}`,
      body: `Support ticket opened from Discord by ${interaction.user.tag}.`,
    }),
  });
  return data;
}

async function syncWebsiteReplies() {
  if (!client.isReady()) return;
  try {
    const overview = await apiRequest('/api/discord/tickets');
    const tickets = Array.isArray(overview.tickets) ? overview.tickets : [];
    for (const ticket of tickets) {
      const channelId = String(ticket.discordThreadId || '').trim();
      if (!channelId) continue;
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      let cursor = ticketSyncCursors.get(ticket.id);
      if (cursor === undefined) {
        const initial = await apiRequest(`/api/discord/tickets/${ticket.id}?after_id=0`);
        const messages = Array.isArray(initial.messages) ? initial.messages : [];
        cursor = messages.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
        ticketSyncCursors.set(ticket.id, cursor);
        continue;
      }

      const data = await apiRequest(`/api/discord/tickets/${ticket.id}?after_id=${encodeURIComponent(cursor)}`);
      const messages = Array.isArray(data.messages) ? data.messages : [];
      for (const item of messages) {
        const messageId = Number(item.id) || 0;
        if (messageId > cursor) cursor = messageId;
        if (item.source === 'discord') continue;
        const author = item.source === 'admin' ? `Staff · ${item.authorName}` : item.authorName || 'Website User';
        await channel.send(`**${author}**\n${String(item.body || '').slice(0, 1900)}`).catch(() => null);
      }
      ticketSyncCursors.set(ticket.id, cursor);
    }
  } catch (error) {
    console.error('[Ticket Sync Error]', error.message);
  }
}

client.once('ready', async ready => {
  console.log(`Discord bot online as ${ready.user.tag}`);
  startHealthServer();
  try { await registerCommands(); } catch (error) { console.error('Command registration failed:', error.message); }
  ready.user.setActivity('NoContext', { type: 3 });
  setInterval(syncWebsiteReplies, 5000);
  syncWebsiteReplies();
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket') {
      try {
        const match = /^nocontext-ticket:(\d+)$/.exec(String(interaction.channel?.topic || ''));
        if (match) await apiRequest('/api/discord/tickets/close', { method:'POST', body:JSON.stringify({ ticket_id:Number(match[1]) }) });
        await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
        setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
      } catch (error) {
        console.error('[Ticket Close Error]', error.message);
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => {});
        else await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;
  try {
    if (command === 'status') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest('/api/health');
      await interaction.editReply(`NoContext API: **${data.status || 'ok'}**`);
      return;
    }

    if (command === 'ticket') {
      await interaction.deferReply({ ephemeral: true });
      const ticket = await createWebsiteTicket(interaction);
      const guild = interaction.guild;
      if (!guild) throw new Error('Tickets can only be opened inside the NoContext server.');
      const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
      ];
      if (STAFF_ROLE_ID) permissionOverwrites.push({ id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] });
      else permissionOverwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().slice(0, 95),
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID || null,
        topic: `nocontext-ticket:${ticket.id}`,
        permissionOverwrites,
      });

      ticketSyncCursors.set(ticket.id, 0);
      await apiRequest('/api/discord/tickets/status', { method:'POST', body:JSON.stringify({ ticket_id:ticket.id, discord_thread_id:channel.id }) });

      const embed = new EmbedBuilder()
        .setTitle('🎫 NoContext Support Ticket')
        .setColor(0xb8ff3d)
        .setDescription(`This Discord ticket is linked to website ticket **#${ticket.id}**.\n\nMessages here are synchronized with the NoContext website dashboard.`)
        .addFields(
          { name: 'Website Ticket', value: `#${ticket.id}`, inline: true },
          { name: 'User', value: interaction.user.tag, inline: true },
        )
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
      await channel.send({ content: STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}>` : '', embeds:[embed], components:[row] });
      await interaction.editReply(`✅ Ticket created: <#${channel.id}>\nWebsite ticket: **#${ticket.id}**`);
      return;
    }

    if (command === 'validate') {
      await interaction.deferReply({ ephemeral: true });
      const key = interaction.options.getString('key', true).trim();
      const product = interaction.options.getString('product') || 'NoContext External';
      const data = await apiRequest('/api/discord/licenses/validate', { method:'POST', body:JSON.stringify({ key, product }) });
      await interaction.editReply(data.valid ? `License is valid until ${formatDate(data.expiresAt)}.` : 'License is invalid.');
      return;
    }

    if (adminCommandNames.includes(command)) requireAdmin(interaction);

    if (command === 'createkey') {
      await interaction.deferReply({ ephemeral: true });
      const data = await adminApiRequest('/api/discord/licenses', { method:'POST', body:JSON.stringify({ duration:interaction.options.getString('duration',true), product:interaction.options.getString('product') || 'NoContext External', user_id:interaction.options.getInteger('user_id') }) }, interaction);
      await interaction.editReply(`License created.\n**ID:** ${data.id}\n**Key:** \`${data.key}\`\n**Product:** ${data.product}\n**Expires:** ${formatDate(data.expiresAt)}`); return;
    }
    if (command === 'revokekey') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest(`/api/discord/licenses/${interaction.options.getInteger('id',true)}/revoke`, { method:'POST' }, interaction);
      await interaction.editReply(`License **${data.id}** revoked.`); return;
    }
    if (command === 'extendkey') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest(`/api/discord/licenses/${interaction.options.getInteger('id',true)}/extend`, { method:'POST', body:JSON.stringify({ days:interaction.options.getInteger('days',true) }) }, interaction);
      await interaction.editReply(`License **${data.id}** now expires ${formatDate(data.expiresAt)}.`); return;
    }
    if (command === 'keyinfo') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest(`/api/discord/licenses/${interaction.options.getInteger('id',true)}`, {}, interaction);
      await interaction.editReply(`**License ${data.id}**\nPrefix: \`${data.keyPrefix}\`\nUser ID: ${data.userId}\nProduct: **${data.product}**\nStatus: **${data.status}**\nExpires: ${formatDate(data.expiresAt)}`); return;
    }
    if (command === 'keys') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest('/api/discord/licenses', {}, interaction);
      await interaction.editReply(data.licenses?.length ? data.licenses.slice(0,25).map(x=>`**${x.id}** · \`${x.keyPrefix}\` · ${x.product} · ${x.status} · ${formatDate(x.expiresAt)}`).join('\n') : 'No licenses found.'); return;
    }
    if (command === 'createapikey') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest('/api/discord/developer-keys', { method:'POST', body:JSON.stringify({ name:interaction.options.getString('name') || 'Discord application' }) }, interaction);
      await interaction.editReply(`Developer API key created.\n**ID:** ${data.id}\n**Name:** ${data.name}\n**Key:** \`${data.apiKey}\``); return;
    }
    if (command === 'revokeapikey') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest(`/api/discord/developer-keys/${interaction.options.getInteger('id',true)}/revoke`, { method:'POST' }, interaction);
      await interaction.editReply(`Developer API key **${data.id}** revoked.`); return;
    }
    if (command === 'apikeyinfo') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest(`/api/discord/developer-keys/${interaction.options.getInteger('id',true)}`, {}, interaction);
      await interaction.editReply(`**Developer API key ${data.id}**\nName: **${data.name}**\nPrefix: \`${data.prefix}\`\nActive: **${data.active ? 'Yes' : 'No'}**\nCreated: ${formatDate(data.createdAt)}\nLast used: ${formatDate(data.lastUsedAt)}`); return;
    }
    if (command === 'info') {
      await interaction.reply({ ephemeral:true, content:`**NoContext Bot**\nAPI: ${API_BASE_URL}\nCommands: ${commands.length}\nSupport: website-linked Discord tickets` }); return;
    }
    if (command === 'help') {
      await interaction.reply({ ephemeral:true, content:'**NoContext Commands**\n/status — API status\n/validate — validate a license\n/ticket — open a website-linked support ticket\n/createkey — create a license (admin)\n/revokekey — revoke a license (admin)\n/extendkey — extend a license (admin)\n/keyinfo — license details (admin)\n/keys — list licenses (admin)\n/createapikey — create developer API key (admin)\n/revokeapikey — revoke developer API key (admin)\n/apikeyinfo — API key details (admin)\n/info — bot information\n/help — this help message' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(`Error: **${message}**`).catch(()=>{});
    else await interaction.reply({ ephemeral:true, content:`Error: **${message}**` }).catch(()=>{});
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  await (async () => {
    const match = /^nocontext-ticket:(\d+)$/.exec(String(message.channel?.topic || ''));
    if (!match) return;
    const ticketId = Number(match[1]);
    if (!Number.isInteger(ticketId) || ticketId < 1) return;
    try {
      await apiRequest('/api/discord/tickets/reply', {
        method:'POST',
        body:JSON.stringify({ ticket_id:ticketId, body:message.content, author_name:message.member?.displayName || message.author.tag }),
      });
    } catch (error) {
      console.error(`[Ticket Message Sync Error] Ticket #${ticketId}:`, error.message);
    }
  })();
});

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
client.login(TOKEN).catch(error => { console.error('Discord login failed:', error.message); process.exit(1); });
