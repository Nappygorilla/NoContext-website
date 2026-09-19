const fs = require('fs');
const path = require('path');

const botPath = path.join(__dirname, 'bot.js');
const workinkUrl = 'https://work.ink/2WZq/no-context-key';
let source = fs.readFileSync(botPath, 'utf8');

if (source.includes("command === 'key'")) {
  process.exit(0);
}

const envLine = "const WORKINK_KEY_URL = String(process.env.WORKINK_KEY_URL || '" + workinkUrl + "').trim();";
const envAnchor = "const TICKET_CHANNEL_ID = String(process.env.DISCORD_TICKET_CHANNEL_ID || '').trim();";
if (!source.includes(envLine)) {
  source = source.replace(envAnchor, `${envAnchor}\n${envLine}`);
}

const commandAnchor = "  new SlashCommandBuilder().setName('ticket').setDescription('Open a support ticket in the luna.win Discord server.'),";
const keyCommand = "  new SlashCommandBuilder().setName('key').setDescription('Get the luna.win free key link.'),";
source = source.replace(commandAnchor, `${commandAnchor}\n${keyCommand}`);

const handlerAnchor = "    if (command === 'validate') {";
const keyHandler = "    if (command === 'key') {\n      await interaction.reply({ ephemeral:true, content:`Get your luna.win free key here: ${WORKINK_KEY_URL}` });\n      return;\n    }\n\n";
source = source.replace(handlerAnchor, `${keyHandler}${handlerAnchor}`);

const helpAnchor = "/ticket — open a support ticket\\n";
source = source.replace(helpAnchor, `${helpAnchor}/key — get the free key link\\n`);

fs.writeFileSync(botPath, source);
console.log('luna.win /key command patch applied.');
