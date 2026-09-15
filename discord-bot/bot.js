const http = require('http');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const API_BASE_URL = String(process.env.NOCONTEXT_API_URL || 'https://nocontext.onrender.com').replace(/\/$/, '');
const BOT_SECRET = process.env.DISCORD_BOT_SECRET || '';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID environment variable.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Check NoContext API status.'),
  new SlashCommandBuilder()
    .setName('validate').setDescription('Validate a NoContext license key.')
    .addStringOption(option => option.setName('key').setDescription('License key').setRequired(true))
    .addStringOption(option => option.setName('product').setDescription('Product name').setRequired(false)),
  new SlashCommandBuilder()
    .setName('createkey').setDescription('Create a NoContext license key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option.setName('duration').setDescription('License duration').setRequired(true).addChoices(
      { name: '3 days', value: '3d' },
      { name: '7 days', value: '7d' },
      { name: 'Lifetime', value: 'lifetime' },
    ))
    .addStringOption(option => option.setName('product').setDescription('Product name').setRequired(false))
    .addIntegerOption(option => option.setName('user_id').setDescription('Website user ID').setRequired(false)),
  new SlashCommandBuilder()
    .setName('revokekey').setDescription('Revoke a NoContext license key by ID.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option => option.setName('id').setDescription('License ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('extendkey').setDescription('Extend a NoContext license key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option => option.setName('id').setDescription('License ID').setRequired(true))
    .addIntegerOption(option => option.setName('days').setDescription('Days to add').setRequired(true).setMinValue(1).setMaxValue(3650)),
  new SlashCommandBuilder()
    .setName('keyinfo').setDescription('Show NoContext license information.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option => option.setName('id').setDescription('License ID').setRequired(true)),
  new SlashCommandBuilder().setName('keys').setDescription('List NoContext license keys.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('createapikey').setDescription('Create a developer API key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option.setName('name').setDescription('API key name').setRequired(false)),
  new SlashCommandBuilder()
    .setName('revokeapikey').setDescription('Revoke a developer API key.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option => option.setName('id').setDescription('API key ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('apikeyinfo').setDescription('Show developer API key information.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option => option.setName('id').setDescription('API key ID').setRequired(true)),
  new SlashCommandBuilder().setName('info').setDescription('Show NoContext bot information.'),
  new SlashCommandBuilder().setName('help').setDescription('Show NoContext bot commands.'),
].map(command => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function startHealthServer() {
  const port = Number(process.env.PORT || 10000);
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ service: 'NoContext Discord Bot', status: 'online' }));
  });
  server.listen(port, '0.0.0.0', () => console.log(`Render health server listening on ${port}`));
}

async function apiRequest(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(BOT_SECRET ? { 'X-Discord-Bot-Secret': BOT_SECRET } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  return data;
}

function isDiscordAdmin(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

function requireAdmin(interaction) {
  if (!isDiscordAdmin(interaction)) throw new Error('Administrator permission is required for this command.');
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`Registered ${commands.length} guild commands.`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`Registered ${commands.length} global commands.`);
  }
}

client.once('ready', async readyClient => {
  console.log(`Discord bot online as ${readyClient.user.tag}`);
  startHealthServer();
  try {
    await registerCommands();
  } catch (error) {
    console.error('Command registration failed:', error.message);
  }
  readyClient.user.setActivity('NoContext', { type: 3 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;

  try {
    if (command === 'status') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest('/api/health');
      await interaction.editReply(`NoContext API: **${data.status || 'ok'}**`);
      return;
    }

    if (command === 'validate') {
      await interaction.deferReply({ ephemeral: true });
      const key = interaction.options.getString('key', true).trim();
      const product = interaction.options.getString('product') || 'NoContext External';
      const data = await apiRequest('/api/discord/licenses/validate', { method: 'POST', body: JSON.stringify({ key, product }) });
      await interaction.editReply(`License **${data.keyPrefix || key.slice(0, 11)}** is valid until ${formatDate(data.expiresAt)}.`);
      return;
    }

    if (['createkey', 'revokekey', 'extendkey', 'keyinfo', 'keys', 'createapikey', 'revokeapikey', 'apikeyinfo'].includes(command)) {
      requireAdmin(interaction);
    }

    if (command === 'createkey') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest('/api/discord/licenses', {
        method: 'POST',
        body: JSON.stringify({
          duration: interaction.options.getString('duration', true),
          product: interaction.options.getString('product') || 'NoContext External',
          user_id: interaction.options.getInteger('user_id'),
        }),
      });
      await interaction.editReply(`License created.\n**ID:** ${data.id}\n**Key:** \`${data.key}\`\n**Product:** ${data.product}\n**Expires:** ${formatDate(data.expiresAt)}`);
      return;
    }

    if (command === 'revokekey') {
      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getInteger('id', true);
      const data = await apiRequest(`/api/discord/licenses/${id}/revoke`, { method: 'POST' });
      await interaction.editReply(`License **${data.id}** revoked.`);
      return;
    }

    if (command === 'extendkey') {
      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getInteger('id', true);
      const days = interaction.options.getInteger('days', true);
      const data = await apiRequest(`/api/discord/licenses/${id}/extend`, { method: 'POST', body: JSON.stringify({ days }) });
      await interaction.editReply(`License **${data.id}** now expires ${formatDate(data.expiresAt)}.`);
      return;
    }

    if (command === 'keyinfo') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest(`/api/discord/licenses/${interaction.options.getInteger('id', true)}`);
      await interaction.editReply(`**License ${data.id}**\nPrefix: \`${data.keyPrefix}\`\nUser ID: ${data.userId}\nProduct: **${data.product}**\nStatus: **${data.status}**\nExpires: ${formatDate(data.expiresAt)}`);
      return;
    }

    if (command === 'keys') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest('/api/discord/licenses');
      if (!data.licenses?.length) {
        await interaction.editReply('No licenses found.');
        return;
      }
      await interaction.editReply(data.licenses.slice(0, 25).map(item => `**${item.id}** · \`${item.keyPrefix}\` · ${item.product} · ${item.status} · ${formatDate(item.expiresAt)}`).join('\n'));
      return;
    }

    if (command === 'createapikey') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest('/api/discord/developer-keys', { method: 'POST', body: JSON.stringify({ name: interaction.options.getString('name') || 'Discord application' }) });
      await interaction.editReply(`Developer API key created.\n**ID:** ${data.id}\n**Name:** ${data.name}\n**Key:** \`${data.apiKey}\``);
      return;
    }

    if (command === 'revokeapikey') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest(`/api/discord/developer-keys/${interaction.options.getInteger('id', true)}/revoke`, { method: 'POST' });
      await interaction.editReply(`Developer API key **${data.id}** revoked.`);
      return;
    }

    if (command === 'apikeyinfo') {
      await interaction.deferReply({ ephemeral: true });
      const data = await apiRequest(`/api/discord/developer-keys/${interaction.options.getInteger('id', true)}`);
      await interaction.editReply(`**Developer API key ${data.id}**\nName: **${data.name}**\nPrefix: \`${data.prefix}\`\nActive: **${data.active ? 'Yes' : 'No'}**\nCreated: ${formatDate(data.createdAt)}\nLast used: ${formatDate(data.lastUsedAt)}`);
      return;
    }

    if (command === 'info') {
      await interaction.reply({ ephemeral: true, content: `**NoContext Bot**\nAPI: ${API_BASE_URL}\nCommands: ${commands.length}\nGuild: ${GUILD_ID || 'Global registration'}` });
      return;
    }

    if (command === 'help') {
      await interaction.reply({ ephemeral: true, content: '**NoContext Commands**\n/status — API status\n/validate — validate a license\n/createkey — create a license\n/revokekey — revoke a license\n/extendkey — extend a license\n/keyinfo — license details\n/keys — list licenses\n/createapikey — create developer API key\n/revokeapikey — revoke developer API key\n/apikeyinfo — API key details\n/info — bot information\n/help — this help message' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(`Error: **${message}**`).catch(() => {});
    else await interaction.reply({ ephemeral: true, content: `Error: **${message}**` }).catch(() => {});
  }
});

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));

client.login(TOKEN).catch(error => {
  console.error('Discord login failed:', error.message);
  process.exit(1);
});
