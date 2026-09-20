// Preloaded (node --require) into a test-spawned server so its Telegram traffic
// is captured instead of sent: every https.request to api.telegram.org appends
// the JSON payload as one line to $TELEGRAM_STUB_FILE and answers 200. Combined
// with a fake token this lets a route-level test assert on the exact message a
// route sends without any chance of reaching a real bot.
'use strict';
const fs = require('fs');
const https = require('https');

https.request = (options, cb) => {
  const chunks = [];
  return {
    on() { return this; },
    write(chunk) { chunks.push(chunk); },
    end() {
      try { fs.appendFileSync(process.env.TELEGRAM_STUB_FILE, Buffer.concat(chunks.map((c) => Buffer.from(c))).toString() + '\n'); } catch { /* test harness only */ }
      const res = { statusCode: 200, on(evt, h) { if (evt === 'data') h('{"ok":true}'); if (evt === 'end') h(); return this; } };
      if (cb) cb(res);
    },
    destroy() {},
  };
};
