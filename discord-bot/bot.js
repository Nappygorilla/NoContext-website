const http = require('http');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const API_BASE_URL = String(process.env.NOCONTEXT_API_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');
const BOT_SECRET = process.env.DISCORD_BOT_SECRET || '';
const TICKET_CHANNEL_ID = String(process.env.DISCORD_TICKET_CHANNEL_ID || '').trim();

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID environment variable.');
  process.exit(1);
}

const adminCommandNames = ['createkey','revokekey','extendkey','keyinfo','keys','createapikey','revokeapikey','apikeyinfo'];
const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Check NoContext API status.'),
  new SlashCommandBuilder().setName('validate').setDescription('Validate a NoContext license key.')
    .addStringOption(o => o.setName('key').setDescription('License key').setRequired(true))
    .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(false)),
  new SlashCommandBuilder().setName('ticket').setDescription('Open a support ticket in the NoContext Discord server.'),
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
    headers: { Accept:'application/json', 'Content-Type':'application/json', ...(BOT_SECRET ? {'X-Discord-Bot-Secret': BOT_SECRET} : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  return data;
}

async function adminApiRequest(path, options, interaction) {
  return apiRequest(path, { ...options, headers: { ...(options?.headers || {}), 'X-Discord-User-ID': interaction.user.id } });
}

function requireAdmin(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) throw new Error('Administrator permission is required for this command.');
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `<t:${Math.floor(date.getTime()/1000)}:f>`;
}

async function registerCommands() {
  const rest = new REST({ version:'10' }).setToken(TOKEN);
  if (GUILD_ID) await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body:commands });
  else await rest.put(Routes.applicationCommands(CLIENT_ID), { body:commands });
  console.log(`Registered ${commands.length} Discord commands.`);
}

client.once('ready', async ready => {
  console.log(`Discord bot online as ${ready.user.tag}`);
  startHealthServer();
  try { await registerCommands(); } catch (error) { console.error('Command registration failed:', error.message); }
  ready.user.setActivity('NoContext', { type:3 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;
  try {
    if (command === 'status') {
      await interaction.deferReply({ ephemeral:true });
      const data = await apiRequest('/api/health');
      await interaction.editReply(`NoContext API: **${data.status || 'ok'}**`);
      return;
    }

    if (command === 'ticket') {
      if (TICKET_CHANNEL_ID) await interaction.reply({ ephemeral:true, content:`Need help? Open a ticket here: <#${TICKET_CHANNEL_ID}>` });
      else await interaction.reply({ ephemeral:true, content:'Need help? Open a support ticket in the NoContext server. The ticket channel has not been configured for the bot yet.' });
      return;
    }

    if (command === 'validate') {
      await interaction.deferReply({ ephemeral:true });
      const key = interaction.options.getString('key', true).trim();
      const product = interaction.options.getString('product') || 'NoContext External';
      const data = await apiRequest('/api/licenses/validate', { method:'POST', body:JSON.stringify({ key, product }) });
      await interaction.editReply(`License is valid until ${formatDate(data.expiresAt)}.`);
      return;
    }

    if (adminCommandNames.includes(command)) requireAdmin(interaction);

    if (command === 'createkey') {
      await interaction.deferReply({ ephemeral:true });
      const data = await adminApiRequest('/api/discord/licenses', { method:'POST', body:JSON.stringify({ duration:interaction.options.getString('duration',true), product:interaction.options.getString('product') || 'NoContext External', user_id:interaction.options.getInteger('user_id') }) }, interaction);
      await interaction.editReply(`License created.\n**ID:** ${data.id}\n**Key:** \`${data.key}\`\n**Product:** ${data.product}\n**Expires:** ${formatDate(data.expiresAt)}`);
      return;
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
      await interaction.reply({ ephemeral:true, content:`**NoContext Bot**\nAPI: ${API_BASE_URL}\nCommands: ${commands.length}\nSupport channel: ${TICKET_CHANNEL_ID ? `<#${TICKET_CHANNEL_ID}>` : 'Not configured'}` }); return;
    }
    if (command === 'help') {
      await interaction.reply({ ephemeral:true, content:'**NoContext Commands**\n/status — API status\n/validate — validate a license\n/ticket — open a support ticket\n/createkey — create a license (admin)\n/revokekey — revoke a license (admin)\n/extendkey — extend a license (admin)\n/keyinfo — license details (admin)\n/keys — list licenses (admin)\n/createapikey — create developer API key (admin)\n/revokeapikey — revoke developer API key (admin)\n/apikeyinfo — API key details (admin)\n/info — bot information\n/help — this help message' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(`Error: **${message}**`).catch(()=>{});
    else await interaction.reply({ ephemeral:true, content:`Error: **${message}**` }).catch(()=>{});
  }
});

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
client.login(TOKEN).catch(error => { console.error('Discord login failed:', error.message); process.exit(1); });
