const fs = require("fs");
const { google } = require("googleapis");

// ===== AUTH =====
const token = JSON.parse(fs.readFileSync("token.json"));
const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const { client_secret, client_id, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

oAuth2Client.setCredentials(token);
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// Prevent duplicate processing
const processedMessages = new Set();

// ===== BODY EXTRACT =====
function getBody(payload) {
  let body = "";

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf8");
      }
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/html" && sub.body?.data) {
            body = Buffer.from(sub.body.data, "base64").toString("utf8");
          }
        }
      }
    }
  } else if (payload.body?.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  return body;
}

// ===== HDFC PARSER =====
function parseHdfcUPI(body) {
  const amountMatch = body.match(/Rs\.?\s?([0-9.]+)/i);
  const vpaMatch = body.match(/by VPA\s+([^\s]+)/i);
  const nameMatch = body.match(/by VPA\s+[^\s]+\s+([A-Z\s]+)/i);
  const txnMatch = body.match(/reference number is\s+([0-9]+)/i);

  return {
    amount: amountMatch ? amountMatch[1] : null,
    vpa: vpaMatch ? vpaMatch[1].toLowerCase() : null,
    name: nameMatch ? nameMatch[1].trim().toLowerCase() : null,
    utr: txnMatch ? txnMatch[1] : null
  };
}

// ===== MAIN CHECK =====
async function checkPayment({ bankName, amount, sessionId, isCancelled }) {
  const START = Date.now();
  const MAX_TIME = 5 * 60 * 1000; // 5 min
  const INTERVAL = 8000;

  const cleanName = bankName.toLowerCase();

  // Today filter
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayQuery = `${yyyy}/${mm}/${dd}`;

  console.log("\n🔍 Payment check started");
  console.log("Verify BANK NAME :", cleanName);
  console.log("Verify AMOUNT    :", amount);
  console.log("Date filter      :", todayQuery);

  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (isCancelled && isCancelled()) {
        console.log("🚫 Server stopped checking (User Cancelled)");
        clearInterval(timer);
        return resolve({ success: false, cancelled: true });
      }

      if (Date.now() - START > MAX_TIME) {
        clearInterval(timer);
        console.log("⏰ Timeout – payment not found");
        return resolve({ success: false });
      }

      try {
        const res = await gmail.users.messages.list({
          userId: "me",
          q: `from:alerts@hdfcbank.net is:unread after:${todayQuery}`,
          maxResults: 5
        });

        if (!res.data.messages) return;

        for (const m of res.data.messages) {
          if (processedMessages.has(m.id)) continue;

          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id
          });

          const body = getBody(msg.data.payload);
          const parsed = parseHdfcUPI(body);

          if (!parsed.amount || !parsed.name || !parsed.utr) continue;

          // 🔥 TERMINAL LOG – ALL DETAILS
          console.log("📌 EMAIL DETAILS →");
          console.log("   ▸ VPA   :", parsed.vpa);
          console.log("   ▸ NAME  :", parsed.name);
          console.log("   ▸ AMT   :", parsed.amount);
          console.log("   ▸ UTR   :", parsed.utr);

          // ✅ VERIFY ONLY BY BANK NAME + AMOUNT
          if (
            parsed.name.includes(cleanName) &&
            Number(parsed.amount) === Number(amount)
          ) {

            // ✅ MARK EMAIL AS READ (FINAL FIX)
            await gmail.users.messages.modify({
              userId: "me",
              id: m.id,
              resource: {
                removeLabelIds: ["UNREAD"]
              }
            });

            processedMessages.add(m.id);

            console.log("📧 EMAIL MARKED AS READ:", m.id);
            console.log("✅ PAYMENT CONFIRMED (BANK NAME VERIFIED)");

            clearInterval(timer);
            return resolve({
              success: true,
              data: {
                name: parsed.name,
                vpa: parsed.vpa,
                amount: parsed.amount,
                utr: parsed.utr
              }
            });
          }

        }
      } catch (err) {
        console.log("❌ Gmail error:", err.message);
      }
    }, INTERVAL);
  });
}

module.exports = { checkPayment };
