import { fetch } from 'undici';

const BASE = process.env.OPENROUTER_BASE?.replace(/\/+$/, '') || 'https://kilocode.ai/api/openrouter';
const MODEL = process.env.MODEL || 'openai/gpt-4.1';
const API_KEY = process.env.KILOCODE_API_KEY;
const REFERER = process.env.OPENROUTER_REFERER;
const TITLE = process.env.OPENROUTER_TITLE || 'Kanna Akizuki Bot';

/**
 * Ask Kilocode (OpenRouter-compatible) with a simple message array.
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @returns {Promise<string>} assistant reply text
 */
export async function askKilocode(messages) {
  if (!API_KEY) {
    throw new Error('Missing KILOCODE_API_KEY in environment.');
  }

  const url = `${BASE}/chat/completions`;

  // Convert to OpenRouter content array format (text only)
  const payload = {
    model: MODEL,
    messages: messages.map(m => ({
      role: m.role,
      content: [{ type: 'text', text: m.content ?? '' }],
    })),
  };

  // First try raw Authorization, then fall back to Bearer if unauthorized
  let res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders('raw'),
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders('bearer'),
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`Kilocode API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Try to read content from OpenAI/OpenRouter style
  const choice = data?.choices?.[0];
  const msg = choice?.message;

  if (!msg) return '';

  // message.content could be a string or an array of parts
  if (typeof msg.content === 'string') {
    return msg.content.trim();
  }

  if (Array.isArray(msg.content)) {
    const textParts = msg.content
      .filter(p => p?.type === 'text' && typeof p.text === 'string')
      .map(p => p.text);
    return textParts.join('').trim();
  }

  return '';
}

function buildHeaders(authStyle = 'raw') {
  const h = {
    'Content-Type': 'application/json',
    'Authorization': authStyle === 'bearer' ? `Bearer ${API_KEY}` : API_KEY,
  };
  if (REFERER) h['HTTP-Referer'] = REFERER;
  if (TITLE) h['X-Title'] = TITLE;
  return h;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}