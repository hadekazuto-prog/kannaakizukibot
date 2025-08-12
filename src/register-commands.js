import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DEV_GUILD_ID } = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}
if (!DISCORD_CLIENT_ID) {
  console.error('Missing DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('come')
    .setDescription('Ask Kanna Akizuki to join your current voice channel and reply in its text chat.')
    .toJSON(),
];

const isSnowflake = (v) => typeof v === 'string' && /^\d{17,20}$/.test(v);

async function main() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    if (isSnowflake(DEV_GUILD_ID)) {
      console.log(`Registering guild commands to guild ${DEV_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DEV_GUILD_ID),
        { body: commands },
      );
      console.log('Guild commands registered.');
    } else {
      if (DEV_GUILD_ID) {
        console.warn('DEV_GUILD_ID is set but not a valid snowflake; registering globally instead.');
      }
      console.log('Registering global commands (may take up to 1 hour to propagate)...');
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commands },
      );
      console.log('Global commands registered.');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
}

main();