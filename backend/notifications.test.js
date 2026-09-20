// Covers the notifyApproved regression found during the community-submissions
// DB audit: it used to build no message at all for a price-less approval
// (closed/suggest_description/other_info), so admins got zero Telegram
// confirmation for those. Stubs https.request so this never touches the real
// Telegram API — no token/chat id needed to run it.
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');

let originalRequest;
let calls;

before(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_CHAT_ID = 'test-chat';
  originalRequest = https.request;
  calls = [];
  https.request = (options, cb) => {
    let body = '';
    calls.push({
      path: options.path,
      captureBody: (b) => { body = b; },
    });
    const fakeRes = {
      statusCode: 200,
      on: (evt, handler) => {
        if (evt === 'data') handler('{"ok":true}');
        if (evt === 'end') handler();
      },
    };
    cb(fakeRes);
    return {
      on: () => {},
      write: (chunk) => { calls[calls.length - 1].body = chunk; },
      end: () => {},
    };
  };
});

after(() => {
  https.request = originalRequest;
});

// Fresh require after the stub is installed (and TELEGRAM_* env vars are
// set) — notifications.js reads process.env.TELEGRAM_BOT_TOKEN once, at
// module load, to decide whether `bot` exists at all.
delete require.cache[require.resolve('./notifications')];
const { notifyApproved, notifyPriceVerified, notifyBulkVerified } = require('./notifications');

describe('notifyApproved', () => {
  test('sends a Telegram message for a price-bearing approval (price_change/new_beer/new_venue)', async () => {
    calls.length = 0;
    await notifyApproved({ venueName: 'Alter Simpl', price: 5.2, reportType: 'price_change' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /Alter Simpl/);
    assert.match(calls[0].body, /5\.2/);
  });

  // The actual bug: a "closed"/"suggest_description"/"other_info" approval
  // carries no price, so the old code's call-site guard (`if (sub.price != null)`)
  // skipped calling this function entirely — no confirmation was ever sent.
  test('still sends a Telegram message when there is no price (closed/other report types)', async () => {
    calls.length = 0;
    await notifyApproved({ venueName: 'Alte Utting', price: null, reportType: 'closed' });
    assert.equal(calls.length, 1, 'a price-less approval must still notify — this is the regression that was fixed');
    assert.match(calls[0].body, /Alte Utting/);
    assert.match(calls[0].body, /closed/);
  });

  test('price-less message never renders the literal string "null" or "undefined"', async () => {
    calls.length = 0;
    await notifyApproved({ venueName: 'Test Venue', price: null, reportType: 'suggest_description' });
    assert.doesNotMatch(calls[0].body, /null|undefined/);
  });
});

describe('notifyPriceVerified (admin one-click verify)', () => {
  const textOf = () => JSON.parse(calls[0].body).text;

  test('sends "✓ Price verified: [venue] €[price] — [admin]"', async () => {
    calls.length = 0;
    await notifyPriceVerified({ venueName: 'Alter Simpl', price: 4.5, admin: 'sittan' });
    assert.equal(calls.length, 1);
    assert.equal(textOf(), '✓ Price verified: Alter Simpl €4.50 — sittan');
  });

  test('escapes venue/admin text so it cannot break Telegram\'s HTML parse mode', async () => {
    calls.length = 0;
    await notifyPriceVerified({ venueName: 'Bar <b>&Co', price: 5, admin: 'a<b' });
    assert.equal(textOf(), '✓ Price verified: Bar &lt;b&gt;&amp;Co €5.00 — a&lt;b');
  });

  test('a missing price never renders "€NaN" / "null"', async () => {
    calls.length = 0;
    await notifyPriceVerified({ venueName: 'X', price: null, admin: 'admin' });
    assert.doesNotMatch(textOf(), /NaN|null|undefined/);
  });
});

describe('notifyBulkVerified (admin bulk verify)', () => {
  const textOf = () => JSON.parse(calls[0].body).text;

  test('sends "✓ Bulk verify: [count] prices verified — [admin]"', async () => {
    calls.length = 0;
    await notifyBulkVerified({ count: 201, admin: 'sittan' });
    assert.equal(calls.length, 1);
    assert.equal(textOf(), '✓ Bulk verify: 201 prices verified — sittan');
  });

  test('escapes the admin name and falls back to "admin"', async () => {
    calls.length = 0;
    await notifyBulkVerified({ count: 3, admin: 'a<b' });
    assert.equal(textOf(), '✓ Bulk verify: 3 prices verified — a&lt;b');
    calls.length = 0;
    await notifyBulkVerified({ count: 3 });
    assert.equal(textOf(), '✓ Bulk verify: 3 prices verified — admin');
  });
});
