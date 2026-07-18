import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const SENSITIVITY_LABELS: Record<number, string> = {
  1: "Low — allows most messages",
  2: "Medium-low",
  3: "Medium — balanced (default)",
  4: "Medium-high",
  5: "High — strict filtering",
};

const RETENTION_OPTIONS = [7, 14, 30, 60, 90];

composer.callbackQuery("settings:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) {
    await ctx.editMessageText("Something went wrong. Tap /start to try again.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const sensLabel = SENSITIVITY_LABELS[user.spamSensitivity] ?? "Unknown";
  const text =
    `⚙️ Your settings\n\n` +
    `Spam sensitivity: ${user.spamSensitivity}/5\n` +
    `${sensLabel}\n\n` +
    `Message retention: ${user.messageRetention} days`;

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([
      [inlineButton("🛡 Spam sensitivity", "settings:spam")],
      [inlineButton("📅 Retention", "settings:retention")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("settings:spam", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) return;

  const buttons = [1, 2, 3, 4, 5].map((level) => [
    inlineButton(
      `${level === user.spamSensitivity ? "✅ " : ""}${level}/5 — ${SENSITIVITY_LABELS[level]}`,
      `settings:setspam:${level}`,
    ),
  ]);

  await ctx.editMessageText("🛡 Spam sensitivity\n\nHigher = stricter filtering. Messages that look like spam get blocked.", {
    reply_markup: inlineKeyboard([...buttons, [inlineButton("⬅️ Back", "settings:show")]]),
  });
});

composer.callbackQuery(/^settings:setspam:(\d)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const level = parseInt(ctx.match![1], 10);
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) return;

  await store.setUser({ ...user, spamSensitivity: level });
  await ctx.editMessageText(`✅ Spam sensitivity set to ${level}/5.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:show")]]),
  });
});

composer.callbackQuery("settings:retention", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) return;

  const buttons = RETENTION_OPTIONS.map((days) => [
    inlineButton(
      `${days === user.messageRetention ? "✅ " : ""}${days} days`,
      `settings:setret:${days}`,
    ),
  ]);

  await ctx.editMessageText("📅 Message retention\n\nHow long messages stay in your inbox before being auto-deleted.", {
    reply_markup: inlineKeyboard([...buttons, [inlineButton("⬅️ Back", "settings:show")]]),
  });
});

composer.callbackQuery(/^settings:setret:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const days = parseInt(ctx.match![1], 10);
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) return;

  await store.setUser({ ...user, messageRetention: days });
  await ctx.editMessageText(`✅ Retention set to ${days} days.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:show")]]),
  });
});

export default composer;
