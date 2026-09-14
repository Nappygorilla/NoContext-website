import os

import aiohttp
import discord
from discord import app_commands
from discord.ext import commands

DISCORD_TOKEN = os.environ["DISCORD_BOT_TOKEN"]
API_BASE_URL = os.getenv("NOCONTEXT_API_URL", "https://nocontext.onrender.com").rstrip("/")
BOT_SECRET = os.environ["DISCORD_BOT_SECRET"]
DISCORD_OWNER_ID = int(os.getenv("DISCORD_OWNER_ID", "0"))

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


def owner_only(interaction: discord.Interaction) -> bool:
    return DISCORD_OWNER_ID > 0 and interaction.user.id == DISCORD_OWNER_ID


async def api_post(path: str, payload: dict):
    headers = {"Content-Type": "application/json", "X-Discord-Bot-Secret": BOT_SECRET}
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{API_BASE_URL}{path}", json=payload, headers=headers, timeout=10) as response:
            data = await response.json(content_type=None)
            if response.status >= 400:
                raise RuntimeError(data.get("detail", f"API request failed ({response.status})"))
            return data


@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"NoContext ticket bot online as {bot.user}")


@bot.tree.command(name="ticket-reply", description="Reply to a NoContext support ticket from Discord.")
@app_commands.describe(ticket_id="The NoContext ticket number", message="The reply to send")
async def ticket_reply(interaction: discord.Interaction, ticket_id: int, message: str):
    if not owner_only(interaction):
        await interaction.response.send_message("You are not authorized to use the support controls.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    try:
        await api_post("/api/discord/tickets/reply", {
            "ticket_id": ticket_id,
            "body": message,
            "author_name": interaction.user.display_name,
        })
        await interaction.followup.send(f"Reply sent to ticket #{ticket_id}.", ephemeral=True)
    except Exception as exc:
        await interaction.followup.send(f"Could not send reply: {exc}", ephemeral=True)


@bot.tree.command(name="ticket-close", description="Close a NoContext support ticket from Discord.")
@app_commands.describe(ticket_id="The NoContext ticket number")
async def ticket_close(interaction: discord.Interaction, ticket_id: int):
    if not owner_only(interaction):
        await interaction.response.send_message("You are not authorized to use the support controls.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    try:
        await api_post("/api/admin/tickets/" + str(ticket_id) + "/close", {})
        await interaction.followup.send(f"Ticket #{ticket_id} closed.", ephemeral=True)
    except Exception as exc:
        await interaction.followup.send(f"Could not close ticket: {exc}", ephemeral=True)


bot.run(DISCORD_TOKEN)
