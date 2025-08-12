Kanna Akizuki — AI Discord Bot (Kilocode GPT‑4.1)

Overview
- Listens and replies only in a voice channel’s chat after you summon it with a slash command.
- Uses Kilocode’s OpenRouter‑compatible endpoint to call GPT‑4.1 with your KILOCODE API key.
- Files:
  - [package.json](package.json)
  - [src/index.js](src/index.js)
  - [src/kilocode.js](src/kilocode.js)
  - [src/register-commands.js](src/register-commands.js)
  - [.env.example](.env.example)

What it does
- /come: Joins your current voice channel and limits reading/replies to that voice channel’s chat only.
- Replies to any user messages posted in that voice channel’s chat.
- Per‑guild scoping: each server maps to exactly one active voice channel at a time; use /come again to move it.

Prerequisites
- Node.js 18.17+ (recommended 20+).
- A Discord application with a bot user.
- In the Discord Developer Portal (Bot tab):
  - Privileged Gateway Intents: enable “Message Content Intent”.
- Invite the bot to your server with scopes: bot, applications.commands.
  - Permissions: View Channel, Send Messages, Read Message History, Connect (voice). Speak is optional.

Setup
1) Install dependencies
   - npm install

2) Create environment file
   - Copy [.env.example](.env.example) to .env and fill values:
     - DISCORD_TOKEN: Your bot token (Bot tab).
     - DISCORD_CLIENT_ID: Your application ID (General Information).
     - DEV_GUILD_ID: Optional; speeds up slash command registration while developing.
     - KILOCODE_API_KEY: Your Kilocode API key.
     - OPENROUTER_BASE: Defaults to https://kilocode.ai/api/openrouter
     - MODEL: Defaults to openai/gpt-4.1
     - SYSTEM_PROMPT: Optional persona.
     - REPLY_PREFIX: Optional prefix for bot replies.

3) Register the slash command
   - If DEV_GUILD_ID is set in .env:
     - npm run register
     - Commands are available almost immediately in that guild.
   - Without DEV_GUILD_ID:
     - npm run register
     - Global registration can take up to an hour.

4) Run the bot
   - Development with auto‑reload:
     - npm run dev
   - Production:
     - npm start

Usage
- Join any voice channel in your server.
- Use /come in that server. The bot will:
  - Join the voice channel.
  - Start reading and replying to messages in that voice channel’s chat only.
- To move it to another voice channel, join the new channel and use /come again.

Kilocode API details
- This project calls Kilocode’s OpenRouter‑compatible endpoint at:
  - https://kilicode.ai/api/openrouter/chat/completions
- Authorization header is your raw KILOCODE_API_KEY (no Bearer prefix), matching the example you provided.

Configuration notes
- Persona: customize SYSTEM_PROMPT in .env to adjust Kanna’s behavior.
- Model: change MODEL if you want a different provider/model supported by Kilocode’s OpenRouter endpoint.
- Reply style: set REPLY_PREFIX (e.g., “Kanna: ”) if you want a consistent prefix.

Project structure
- [src/index.js](src/index.js)
  - Discord client, intents, events, /come handling, voice channel scoping.
- [src/kilocode.js](src/kilocode.js)
  - Minimal client for Kilocode’s OpenRouter endpoint; converts messages to text parts array and returns the assistant reply.
- [src/register-commands.js](src/register-commands.js)
  - Registers the /come command to a guild (DEV_GUILD_ID) or globally.

Troubleshooting
- Bot doesn’t respond:
  - Ensure “Message Content Intent” is enabled and the bot has permission to read/send in the voice channel’s chat.
  - Verify DISCORD_TOKEN is correct.
  - Check that /come was used and the bot joined your current voice channel.
- Command not found:
  - If you used global registration, wait up to an hour. For instant testing, set DEV_GUILD_ID and re‑run npm run register.
- API errors:
  - Verify KILOCODE_API_KEY and network access to https://kilocode.ai/api/openrouter
  - Check MODEL supports chat/completions on Kilocode.

Security
- Never commit your .env with real secrets.
- Rotate tokens if they leak.

License
- MIT (feel free to adapt).