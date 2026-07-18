import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { generateToken } from "../storage.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

// ─── Deep link: anonymous message submission ────────────────────────────────

composer.command("start", async (ctx, next) => {
  const payload = ctx.message?.text?.split(/\s+/).slice(1).join(" ").trim();
  if (!payload) return next(); // no token — let start.ts handle it

  const store = getBotStore();
  const recipient = await store.getUserByToken(payload);
  if (!recipient) {
    await ctx.reply("This link is invalid or has expired. Please ask the sender for a new one.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.step = "awaiting_anon_message";
  ctx.session.incomingToken = payload;
  await ctx.reply("✍️ Send your anonymous message now. It will be delivered privately.", {
    reply_markup: { force_reply: true, selective: true, input_field_placeholder: "Type your anonymous message…" } as any,
  });
});

// ─── Handle incoming anonymous message text ─────────────────────────────────

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_anon_message" || !ctx.session.incomingToken) {
    return next();
  }

  const content = ctx.message.text.trim();
  if (content.length === 0) {
    await ctx.reply("Message can't be empty. Try again or tap /cancel.");
    return;
  }
  if (content.length > 2000) {
    await ctx.reply("Message is too long (max 2000 characters). Try again or tap /cancel.");
    return;
  }

  const store = getBotStore();
  const recipient = await store.getUserByToken(ctx.session.incomingToken);
  if (!recipient) {
    ctx.session.step = undefined;
    ctx.session.incomingToken = undefined;
    await ctx.reply("This link has expired. Please ask the sender for a new one.");
    return;
  }

  const msgId = generateToken();
  await store.addMessage({
    id: msgId,
    recipientToken: ctx.session.incomingToken,
    content,
    timestamp: Date.now(),
    status: "unread",
  });

  ctx.session.step = undefined;
  ctx.session.incomingToken = undefined;

  await ctx.reply("✅ Your anonymous message was delivered! The recipient will see it in their inbox.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

// ─── Reply to an anonymous message ──────────────────────────────────────────

composer.callbackQuery(/^msg:reply:(.+)$/, async (ctx) => {
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

  ctx.session.step = "awaiting_reply";
  ctx.session.replyToMessageId = messageId;
  await ctx.editMessageText(`✍️ Replying to anonymous message:\n\n"${msg.content.slice(0, 200)}"`, {
    reply_markup: { force_reply: true, selective: true, input_field_placeholder: "Type your reply…" } as any,
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_reply" || !ctx.session.replyToMessageId) {
    return next();
  }

  const content = ctx.message.text.trim();
  if (content.length === 0) {
    await ctx.reply("Reply can't be empty. Try again or tap /cancel.");
    return;
  }

  const store = getBotStore();
  const original = await store.getMessage(ctx.session.replyToMessageId);
  if (!original) {
    ctx.session.step = undefined;
    ctx.session.replyToMessageId = undefined;
    await ctx.reply("That message no longer exists.");
    return;
  }

  const replyId = generateToken();
  await store.addMessage({
    id: replyId,
    recipientToken: original.recipientToken,
    content: `↩️ Reply to your message:\n${content}`,
    timestamp: Date.now(),
    status: "unread",
  });

  ctx.session.step = undefined;
  ctx.session.replyToMessageId = undefined;

  await ctx.reply("✅ Your reply was sent!", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

// ─── Delete a message ───────────────────────────────────────────────────────

composer.callbackQuery(/^msg:delete:(.+)$/, async (ctx) => {
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

  await store.updateMessage(messageId, { status: "deleted" });
  await ctx.editMessageText("🗑 Message deleted.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

// ─── Cancel any active flow ─────────────────────────────────────────────────

composer.command("cancel", async (ctx) => {
  if (ctx.session.step) {
    ctx.session.step = undefined;
    ctx.session.incomingToken = undefined;
    ctx.session.replyToMessageId = undefined;
    await ctx.reply("Cancelled. Tap /start to go back to the menu.");
  }
});

export default composer;
