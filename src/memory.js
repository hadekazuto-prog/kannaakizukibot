import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class Memory {
  /**
   * @param {{ path: string, channelLimit?: number }} options
   */
  constructor(options) {
    this.path = options.path || 'data/memory.json';
    this.channelLimit = Number.isFinite(options.channelLimit) ? options.channelLimit : 100;
    this.state = { guilds: {} };
    this._loaded = false;
  }

  async load() {
    if (this._loaded) return;
    try {
      const buf = await readFile(this.path);
      this.state = JSON.parse(String(buf));
    } catch {
      // fresh state
      await this._ensureDir();
      await this._save(); // create empty file
    }
    this._loaded = true;
  }

  async _ensureDir() {
    await mkdir(dirname(this.path), { recursive: true });
  }

  async _save() {
    const tmp = `${this.path}.tmp`;
    const data = JSON.stringify(this.state, null, 2);
    await writeFile(tmp, data);
    await writeFile(this.path, data);
  }

  _ensureGuild(guildId) {
    const g = (this.state.guilds[guildId] ||= { channels: {}, users: {} });
    return g;
  }

  _ensureChannel(guildId, channelId) {
    const g = this._ensureGuild(guildId);
    const c = (g.channels[channelId] ||= { messages: [] });
    return c;
  }

  _ensureUser(guildId, userId, username) {
    const g = this._ensureGuild(guildId);
    const u = (g.users[userId] ||= { name: username, facts: [], lastSeen: 0 });
    if (username && u.name !== username) u.name = username;
    return u;
  }

  /**
   * Append a message to channel memory.
   * @param {{guildId:string, channelId:string, userId:string, username:string, role:'user'|'assistant', text:string, ts?:number}} msg
   */
  async addMessage(msg) {
    await this.load();

    const ts = msg.ts ?? Date.now();
    const g = this._ensureGuild(msg.guildId);
    this._ensureUser(msg.guildId, msg.userId, msg.username);
    const channel = this._ensureChannel(msg.guildId, msg.channelId);

    channel.messages.push({
      userId: msg.userId,
      name: msg.username,
      role: msg.role || 'user',
      text: msg.text,
      ts,
    });

    // Trim
    const limit = this.channelLimit;
    if (channel.messages.length > limit) {
      channel.messages.splice(0, channel.messages.length - limit);
    }

    g.users[msg.userId].lastSeen = ts;

    await this._save();
  }

  /**
   * Get the most recent N messages from a channel.
   * @param {string} guildId
   * @param {string} channelId
   * @param {number} limit
   * @returns {Array<{role:'user'|'assistant', name:string, text:string, ts:number}>}
   */
  async getRecentChannelMessages(guildId, channelId, limit = 20) {
    await this.load();
    const c = this.state.guilds[guildId]?.channels?.[channelId];
    if (!c) return [];
    const slice = c.messages.slice(-limit);
    return slice;
  }

  /**
   * Add a fact to a user's profile memory.
   * @param {string} guildId
   * @param {string} userId
   * @param {string} fact
   */
  async rememberUserFact(guildId, userId, fact) {
    await this.load();
    const u = this._ensureUser(guildId, userId, '');
    if (!u.facts.includes(fact)) {
      u.facts.push(fact);
      await this._save();
    }
  }

  /**
   * Get a user's profile memory as a text snippet.
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async getUserProfileText(guildId, userId) {
    await this.load();
    const u = this.state.guilds[guildId]?.users?.[userId];
    if (!u) return '';
    const parts = [];
    if (u.name) parts.push(`Name: ${u.name}`);
    if (u.facts?.length) parts.push(`Facts: ${u.facts.join('; ')}`);
    return parts.join(' | ');
  }
}