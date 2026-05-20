import { NextRequest, NextResponse } from "next/server";
import { getWalletByChatId } from "@/lib/telegram-store";

// Telegram webhook handler — responds to /start, /myid, /help, /status, /campaign
// Set webhook with: scripts/setup-telegram-bot.ts

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => null);
}

export async function POST(request: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot not configured" }, { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const msg = update.message;
  if (!msg || !msg.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const firstName = msg.from?.first_name || "there";

  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(
      chatId,
      [
        `🛡️ <b>Welcome to Aegis Protocol, ${firstName}!</b>`,
        ``,
        `Aegis is AI-powered DeFi protection on BNB Chain. This bot sends you real-time security alerts for your wallet.`,
        ``,
        `<b>Your Chat ID:</b> <code>${chatId}</code>`,
        ``,
        `<b>How to link your wallet:</b>`,
        `1. Visit <a href="https://aegisguardian.xyz/guardian">aegisguardian.xyz/guardian</a>`,
        `2. Connect your wallet`,
        `3. Click "Link Telegram" in the sidebar`,
        `4. Paste your Chat ID: <code>${chatId}</code>`,
        ``,
        `Once linked, you'll get instant alerts for:`,
        `• 🚨 Critical threats (rug pulls, honeypots)`,
        `• ⚠️ Whale dump warnings`,
        `• 💧 Liquidity pull alerts`,
        ``,
        `Need help? Type /help`,
      ].join("\n"),
    );
  } else if (text === "/myid") {
    await sendMessage(chatId, `Your Chat ID: <code>${chatId}</code>\n\nPaste this on aegisguardian.xyz/guardian to link your wallet.`);
  } else if (text === "/help") {
    await sendMessage(
      chatId,
      [
        `🛡️ <b>Aegis Guardian Help</b>`,
        ``,
        `<b>Commands:</b>`,
        `/start, Get your Chat ID and setup link`,
        `/myid, Show your Chat ID`,
        `/status, Check your alert subscription`,
        `/campaign, See your Protector Hunt entries`,
        `/help, Show this message`,
        ``,
        `<b>About Aegis:</b>`,
        `• 🔍 <b>Scanner</b>, Detect rug pulls in 5 seconds`,
        `• 🛡️ <b>Guardian</b>, Wallet monitoring + alerts`,
        `• 🏦 <b>Vault</b>, Earn Venus yield with AI stop-loss`,
        ``,
        `Website: <a href="https://aegisguardian.xyz">aegisguardian.xyz</a>`,
      ].join("\n"),
    );
  } else if (text === "/status") {
    await sendMessage(
      chatId,
      [
        `📡 <b>Subscription Status</b>`,
        ``,
        `Your Chat ID: <code>${chatId}</code>`,
        ``,
        `To check if your wallet is linked, visit <a href="https://aegisguardian.xyz/guardian">aegisguardian.xyz/guardian</a> and look at the Telegram section.`,
      ].join("\n"),
    );
  } else if (text === "/campaign" || text === "/hunt") {
    const wallet = await getWalletByChatId(String(chatId));
    if (!wallet) {
      await sendMessage(
        chatId,
        [
          `🛡️ <b>Protector Hunt</b>`,
          ``,
          `No wallet is linked to this Telegram yet.`,
          ``,
          `1. Visit <a href="https://aegisguardian.xyz/guardian">aegisguardian.xyz/guardian</a>`,
          `2. Connect your wallet`,
          `3. Paste your Chat ID: <code>${chatId}</code>`,
          ``,
          `Then run /campaign here again to see your live entry count.`,
        ].join("\n"),
      );
    } else {
      try {
        const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://aegisguardian.xyz";
        const [entriesRes, lbRes] = await Promise.all([
          fetch(`${origin}/api/campaign/entries?address=${wallet}`, { cache: "no-store" }),
          fetch(`${origin}/api/campaign/leaderboard`, { cache: "no-store" }),
        ]);
        const entries = entriesRes.ok ? await entriesRes.json() : null;
        const lb = lbRes.ok ? await lbRes.json() : null;
        const myRank = lb?.leaders?.find(
          (l: { wallet: string; rank: number }) =>
            l.wallet.toLowerCase().startsWith(wallet.slice(0, 6).toLowerCase()),
        )?.rank;
        if (!entries) {
          await sendMessage(chatId, `Couldn't fetch your campaign data right now. Try again in a minute.`);
        } else if (entries.disqualified) {
          await sendMessage(
            chatId,
            `🚫 This wallet has been disqualified from Protector Hunt. See aegisguardian.xyz/campaign/disqualified for the reason.`,
          );
        } else {
          await sendMessage(
            chatId,
            [
              `🛡️ <b>Protector Hunt — your entries</b>`,
              ``,
              `Wallet: <code>${wallet.slice(0, 6)}…${wallet.slice(-4)}</code>`,
              `<b>Total entries: ${entries.totalEntries}</b>${myRank ? ` · rank #${myRank}` : ""}`,
              ``,
              `• Social: ${entries.breakdown.social}`,
              `• Scans: ${entries.breakdown.scan} (${entries.scanCount}/5 unique)`,
              `• Guardian: ${entries.breakdown.guardian}`,
              `• Telegram: ${entries.breakdown.telegram}`,
              `• Holder (${entries.holderTier}): ${entries.breakdown.hold}`,
              `• Referrals: ${entries.breakdown.referral} (${entries.referralCount}/10 qualified)`,
              ``,
              `🎯 Pool: 25,000,000 $UNIQ · up to 151 winners`,
              `🔗 <a href="https://aegisguardian.xyz/campaign">aegisguardian.xyz/campaign</a>`,
            ].join("\n"),
          );
        }
      } catch {
        await sendMessage(chatId, `Couldn't fetch your campaign data right now. Try again in a minute.`);
      }
    }
  } else {
    await sendMessage(
      chatId,
      `I only respond to commands. Try /start, /myid, /campaign, or /help.\n\nVisit <a href="https://aegisguardian.xyz">aegisguardian.xyz</a> to use the full app.`,
    );
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    configured: !!BOT_TOKEN,
    info: "Webhook endpoint for Telegram bot",
  });
}
