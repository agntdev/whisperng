import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { generateToken } from "../storage.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

// ─── /report command — report the last viewed message ───────────────────────

composer.command("report", async (ctx) => {
  await ctx.reply("To report a message, open your Inbox, tap 🚩 Report on the message, and choose a reason.", {
    reply_markup: inlineKeyboard([
      [inlineButton("📥 Open Inbox", "inbox:list")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

// ─── Report a specific message via callback ─────────────────────────────────

composer.callbackQuery(/^msg:report:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const messageId = ctx.match![1];
  const store = getBotStore();
  const msg = await store.getMessage(messageId);
  if (!msg) {
    await ctx.editMessageText("This message no longer exists.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  await ctx.editMessageText(
    `🚩 Report this message?\n\n"${msg.content.slice(0, 200)}"`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🚩 Spam", `report:submit:${messageId}:spam`)],
        [inlineButton("⚠️ Harassment", `report:submit:${messageId}:harassment`)],
        [inlineButton("🔞 Inappropriate", `report:submit:${messageId}:inappropriate`)],
        [inlineButton("Cancel", "inbox:list")],
      ]),
    },
  );
});

// ─── Submit the report with a reason ────────────────────────────────────────

composer.callbackQuery(/^report:submit:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const messageId = ctx.match![1];
  const reason = ctx.match![2];

  const store = getBotStore();
  const reportId = generateToken();
  await store.addReport({
    id: reportId,
    messageId,
    reporterId: ctx.from!.id,
    reason,
    resolved: false,
    createdAt: Date.now(),
  });

  await store.updateMessage(messageId, { status: "deleted" });

  const reasonLabel: Record<string, string> = {
    spam: "Spam",
    harassment: "Harassment",
    inappropriate: "Inappropriate content",
  };

  await ctx.editMessageText(
    `✅ Report submitted — ${reasonLabel[reason] ?? reason}.\n\nWe'll review this and take action. Thank you for helping keep WhisperNG safe.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("📥 Back to Inbox", "inbox:list")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

export default composer;
