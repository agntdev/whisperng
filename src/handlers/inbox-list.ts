import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { inlineButton, inlineKeyboard, paginate } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

function formatTime(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

async function showInbox(ctx: Ctx, page: number): Promise<void> {
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) {
    await ctx.editMessageText("Something went wrong. Tap /start to try again.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const all = await store.getInbox(user.anonymousToken);
  const active = all.filter((m) => m.status !== "deleted").sort((a, b) => b.timestamp - a.timestamp);

  if (active.length === 0) {
    await ctx.editMessageText("📭 Your inbox is empty. Share your anonymous link to receive messages.", {
      reply_markup: inlineKeyboard([
        [inlineButton("💬 My Link", "link:preview")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const { pageItems, controls } = paginate(active, {
    page,
    perPage: 5,
    callbackPrefix: "inbox:pg",
  });

  const lines = pageItems.map((m, i) => {
    const num = page * 5 + i + 1;
    const status = m.status === "unread" ? "🆕 " : "";
    return `${status}#${num} — ${formatTime(m.timestamp)}\n${truncate(m.content, 80)}`;
  });

  const text = `📥 Inbox (${active.length} messages)\n\n${lines.join("\n\n")}`;

  const buttons = pageItems.map((m) => [
    inlineButton("💬 Reply", `msg:reply:${m.id}`),
    inlineButton("🚩 Report", `msg:report:${m.id}`),
    inlineButton("🗑 Delete", `msg:delete:${m.id}`),
  ]);

  const keyboard = inlineKeyboard([...buttons, ...controls.inline_keyboard, [inlineButton("⬅️ Back to menu", "menu:main")]]);

  await ctx.editMessageText(text, { reply_markup: keyboard });
}

composer.callbackQuery("inbox:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showInbox(ctx, 0);
});

composer.callbackQuery(/^inbox:pg:prev:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = parseInt(ctx.match![1], 10);
  await showInbox(ctx, page);
});

composer.callbackQuery(/^inbox:pg:next:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = parseInt(ctx.match![1], 10);
  await showInbox(ctx, page);
});

export default composer;
