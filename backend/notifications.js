// Telegram admin notifications. Entirely optional — every function here is a
// no-op if TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID aren't set, and every call site
// is wrapped so a Telegram outage or bad token can never crash a request or
// the server boot. Token/chat id live only in .env, never in code.
//
// Talks to the Bot API directly over Node's built-in `https` rather than the
// `node-telegram-bot-api` package: its current major version ships a
// completely different API (Bot/Api classes, not `new TelegramBot(token)`),
// and the last version with the classic API (0.67.0) depends on the
// long-deprecated `request` package, which carries a CRITICAL SSRF advisory
// (plus a critical `form-data` one) — not worth pulling in for one endpoint
// that only ever calls sendMessage.
const https = require('https');

let bot;
try {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = { token: process.env.TELEGRAM_BOT_TOKEN };
  }
} catch (e) { console.log('Telegram not configured'); }

function telegramApiCall(method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${bot.token}/${method}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`Telegram API ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Telegram request timed out')));
    req.write(body);
    req.end();
  });
}

async function sendTelegramMessage(message) {
  try {
    if (bot && process.env.TELEGRAM_CHAT_ID) {
      await telegramApiCall('sendMessage', {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      });
    }
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

const ADMIN_URL = 'https://muenchner-bierpreis-production.up.railway.app/admin';

// A venue/brand/note can contain characters that break Telegram's HTML
// parse_mode (<, >, &) — escape anything interpolated into a message.
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTimestamp(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

// ─── Event-specific messages ─────────────────────────────────────────────────
// One function per notification the app sends, so server.js call sites stay a
// one-liner and the message layout lives in exactly one place.

function notifyNewPriceReport({ venueName, neighbourhoodName, price, size, brand, submitterName, visitDate, isOutlier }) {
  return sendTelegramMessage(
    `🍺 <b>New Price Report</b>\n` +
    `📍 ${esc(venueName)} · ${esc(neighbourhoodName)}\n` +
    `💶 €${price} (${esc(size)}) · 🍻 ${esc(brand)}\n` +
    `👤 ${esc(submitterName)} · 📅 ${esc(visitDate)}\n` +
    `⚠️ Outlier: ${isOutlier ? 'Yes' : 'No'}\n` +
    `→ ${ADMIN_URL}`
  );
}

function notifyNewVenue({ name, address, neighbourhoodName, price, submitterName }) {
  return sendTelegramMessage(
    `🆕 <b>New Venue Suggested</b>\n` +
    `📍 ${esc(name)} · 📮 ${esc(address)}\n` +
    `🗺️ ${esc(neighbourhoodName)} · 💶 €${price}\n` +
    `👤 ${esc(submitterName)}\n` +
    `→ ${ADMIN_URL}`
  );
}

function notifyClosure({ venueName, neighbourhoodName, submitterName, visitDate }) {
  return sendTelegramMessage(
    `🔒 <b>Closure Report</b>\n` +
    `📍 ${esc(venueName)} · ${esc(neighbourhoodName)}\n` +
    `👤 ${esc(submitterName)} · 📅 ${esc(visitDate)}\n` +
    `→ ${ADMIN_URL}`
  );
}

function notifyIncorrectInfo({ venueName, note, submitterName }) {
  return sendTelegramMessage(
    `ℹ️ <b>Incorrect Info Report</b>\n` +
    `📍 ${esc(venueName)}\n` +
    `💬 "${esc(note)}"\n` +
    `👤 ${esc(submitterName)}\n` +
    `→ ${ADMIN_URL}`
  );
}

function notifyApproved({ venueName, price }) {
  return sendTelegramMessage(
    `✅ <b>Approved</b>\n` +
    `📍 ${esc(venueName)} price updated → €${price}\n` +
    `🕐 ${formatTimestamp()}`
  );
}

function notifyStartup() {
  return sendTelegramMessage(
    `🍺 <b>Bierpreis server started</b>\n` +
    `Admin notifications active ✅\n` +
    `🕐 ${formatTimestamp()}`
  );
}

module.exports = {
  sendTelegramMessage,
  notifyNewPriceReport,
  notifyNewVenue,
  notifyClosure,
  notifyIncorrectInfo,
  notifyApproved,
  notifyStartup,
};
