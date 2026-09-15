const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
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
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check NoContext API status.'),
  new SlashCommandBuilder()
    .setName('validate')
    .setDescription('Validate a NoContext license key.')
    .addStringOption(option =>
      option
        .setName('key')
        .setDescription('The license key to validate.')
        .setRequired(true)
    ),
].map(command => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function apiRequest(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(BOT_SECRET ? { 'X-Discord-Bot-Secret': BOT_SECRET } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail || data.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return data;
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
  try {
    await registerCommands();
  } catch (error) {
    console.error('Command registration failed:', error.message);
  }
  readyClient.user.setActivity('NoContext', { type: 3 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const data = await apiRequest('/api/health');
      const status = data.status || 'ok';
      await interaction.editReply(`NoContext API: **${status}**`);
    } catch (error) {
      await interaction.editReply(`NoContext API is unavailable: **${error.message}**`);
    }
    return;
  }

  if (interaction.commandName === 'validate') {
    await interaction.deferReply({ ephemeral: true });
    const key = interaction.options.getString('key', true).trim();
    if (!key) {
      await interaction.editReply('Please provide a license key.');
      return;
    }

    try {
      const data = await apiRequest('/api/v1/licenses/validate', {
        method: 'POST',
        headers: {
          'X-NoContext-API-Key': key,
        },
        body: JSON.stringify({}),
      });
      const valid = data.valid ?? data.success ?? true;
      await interaction.editReply(valid ? 'License key is valid.' : 'License key is invalid.');
    } catch (error) {
      await interaction.editReply(`License validation failed: **${error.message}**`);
    }
  }
});

client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));

client.login(TOKEN).catch(error => {
  console.error('Discord login failed:', error.message);
  process.exit(1);
});
