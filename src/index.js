import 'dotenv/config';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  MessageFlags,
} from 'discord.js';
import {
  joinVoiceChannel,
  getVoiceConnection,
} from '@discordjs/voice';
import { askKilocode } from './kilocode.js';
import { Memory } from './memory.js';

const {
  DISCORD_TOKEN,
  SYSTEM_PROMPT,
  REPLY_PREFIX = '',
  REPLY_STRIP_ASSISTANT_NAME = 'true',
  ASSISTANT_ALIASES = '',
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in environment.');
  process.exit(1);
}

const memory = new Memory({
  path: process.env.MEMORY_PATH || 'data/memory.json',
  channelLimit: Number(process.env.MEMORY_CHANNEL_LIMIT || 200),
});

// Utilities to sanitize assistant output and escape regex
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeAssistantReply(text, names) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return trimmed;
  const pattern = new RegExp(
    '^\\s*(?:' + names.map(n => escapeRegex(n)).join('|') + ')\\s*[:\\-—–]\\s*',
    'i'
  );
  return trimmed.replace(pattern, '').trim();
}

// Track which Voice Channel chat the bot should read per guild
// Map<guildId, voiceChannelId>
const activeVoiceChatByGuild = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}.`);
});

// Respond only inside the selected Voice Channel's text chat
client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guildId) return;
    if (message.author.bot) return;

    const allowedChannelId = activeVoiceChatByGuild.get(message.guildId);
    if (!allowedChannelId) return;

    // Only react to messages in the voice channel's text chat we were summoned to
    if (message.channel.type !== ChannelType.GuildVoice) return;
    if (message.channel.id !== allowedChannelId) return;

    const system = SYSTEM_PROMPT ?? 'You are Kanna Akizuki, a friendly, helpful AI assistant for this Discord server. Keep replies concise and helpful.';
    const userText = message.content?.trim() ?? '';

    if (!userText) return;

    // Build display name and fetch recent memory
    const displayName = message.member?.displayName ?? message.author.globalName ?? message.author.username;

    const history = await memory.getRecentChannelMessages(message.guildId, message.channel.id, 30);

    // Transform history into chat messages that preserve speaker names
    const historyMsgs = history.map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.role === 'assistant' ? `${h.text}` : `${h.name}: ${h.text}`,
    }));

    const messages = [
      { role: 'system', content: `${system}\nAlways keep track of who said what. Address users by their display names. Do not prefix your replies with your name (e.g., "Kanna Akizuki:"). Reply directly. The following context includes speaker tags like "Name: message".` },
      ...historyMsgs,
      { role: 'user', content: `${displayName}: ${userText}` },
    ];

    const replyText = await askKilocode(messages);

    if (replyText) {
      const aliasList = [
        client.user?.username,
        client.user?.globalName,
        ...String(ASSISTANT_ALIASES || '').split(',').map(s => s.trim()).filter(Boolean),
        'Kanna',
        'Kanna Akizuki',
      ].filter(Boolean);

      const cleaned = (String(REPLY_STRIP_ASSISTANT_NAME).toLowerCase() === 'true' || REPLY_STRIP_ASSISTANT_NAME === '1')
        ? sanitizeAssistantReply(replyText, aliasList)
        : replyText;

      // Persist both the user message and the assistant reply
      await memory.addMessage({
        guildId: message.guildId,
        channelId: message.channel.id,
        userId: message.author.id,
        username: displayName,
        role: 'user',
        text: userText,
      });

      await memory.addMessage({
        guildId: message.guildId,
        channelId: message.channel.id,
        userId: client.user.id,
        username: client.user.username,
        role: 'assistant',
        text: cleaned,
      });

      await message.reply(`${REPLY_PREFIX}${cleaned}`.trim());
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

// Handle /come via interaction (command is registered by register-commands script)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'come') return;

  const member = interaction.member;
  const me = interaction.guild?.members?.me;

  if (!interaction.guild || !member) {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const voiceChannel = member.voice?.channel;
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: 'Join a voice channel first, then use /come.', flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    // Join the voice channel (not playing audio; presence indicates availability)
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    // Limit reading to this voice channel's text chat
    activeVoiceChatByGuild.set(voiceChannel.guild.id, voiceChannel.id);

    await interaction.reply({
      content: `Kanna Akizuki is here. I will read and reply in the text chat of ${voiceChannel.toString()}.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.error('Failed to join voice channel:', err);
    await interaction.reply({ content: 'Failed to join the voice channel.', flags: MessageFlags.Ephemeral });
  }
});

// Optional: clean up when the bot is kicked from a voice channel
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  // If the bot left the voice channel, clear the active mapping for that guild
  const meId = client.user?.id;
  if (!meId) return;

  const wasMe = oldState?.id === meId || newState?.id === meId;
  if (!wasMe) return;

  const connection = getVoiceConnection(oldState.guild.id);
  if (!connection) {
    // No connection means we left; stop listening to that voice channel chat
    activeVoiceChatByGuild.delete(oldState.guild.id);
  }
});

client.login(DISCORD_TOKEN);