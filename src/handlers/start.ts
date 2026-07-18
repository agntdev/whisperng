import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { generateToken } from "../storage.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";

registerMainMenuItem({ label: "💬 My Link", data: "link:preview", order: 10 });
registerMainMenuItem({ label: "📥 Inbox", data: "inbox:list", order: 20 });
registerMainMenuItem({ label: "⚙️ Settings", data: "settings:show", order: 40 });

const WELCOME = "👋 Welcome to WhisperNG! Tap a button below to get started.";

const composer = new Composer<Ctx>();

async function ensureUser(ctx: Ctx): Promise<void> {
  const store = getBotStore();
  const existing = await store.getUser(ctx.from!.id);
  if (existing) return;
  const token = generateToken();
  await store.setUser({
    telegramId: ctx.from!.id,
    anonymousToken: token,
    spamSensitivity: 3,
    messageRetention: 30,
    createdAt: Date.now(),
  });
}

function dashboardKeyboard(): ReturnType<typeof inlineKeyboard> {
  return inlineKeyboard([
    [inlineButton("💬 My Link", "link:preview"), inlineButton("📥 Inbox", "inbox:list")],
    [inlineButton("⚙️ Settings", "settings:show")],
  ]);
}

composer.command("start", async (ctx) => {
  await ensureUser(ctx);
  await ctx.reply(WELCOME, { reply_markup: dashboardKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: dashboardKeyboard() });
});

export default composer;
