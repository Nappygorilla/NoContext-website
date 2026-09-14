# NoContext Discord Ticket Bot

The bot bridges owner Discord replies into the website ticket system.

## Environment variables

- `DISCORD_BOT_TOKEN` — Discord bot token. Keep this private.
- `DISCORD_BOT_SECRET` — long random secret that must exactly match the website API environment variable.
- `DISCORD_OWNER_ID` — the Discord user ID allowed to run `/ticket-reply`.
- `NOCONTEXT_API_URL` — defaults to `https://nocontext.onrender.com`.

## Website environment variables

Set these on the NoContext Render web service:

- `DISCORD_BOT_SECRET` — same secret used by the bot.
- `DISCORD_TICKET_WEBHOOK_URL` — optional Discord webhook URL for posting new tickets and website replies into a support channel.

The webhook URL should never be placed in frontend JavaScript.

## Run

```bash
pip install -r requirements.txt
python bot.py
```

The website remains the source of truth for ticket history. Discord is an owner/staff interface: `/ticket-reply <ticket_id> <message>` writes the reply back into the same ticket conversation.
