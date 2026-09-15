# NoContext Discord Bot

This bot is the Node.js Discord bot for the NoContext website/backend.

## Local

From this directory:

```bash
npm install
npm start
```

Set the environment variables from `.env.example` before starting the bot.

## Render

The bot is designed to run as a Render Node service with:

- Build: `cd discord-bot && npm install`
- Start: `cd discord-bot && npm start`
- Region: Virginia
- Auto-deploy: enabled from `main`

Required Render secrets:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`

Optional:

- `DISCORD_GUILD_ID` for fast guild-scoped slash-command registration
- `NOCONTEXT_API_URL` (defaults to `https://nocontext.onrender.com`)
- `DISCORD_BOT_SECRET` for backend endpoints that require the bot secret
