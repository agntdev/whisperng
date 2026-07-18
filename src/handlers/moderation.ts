import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

function formatTime(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
};

composer.callbackQuery("mod:reports", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getBotStore();
  const reports = await store.getReports();
  const pending = reports.filter((r) => !r.resolved);

  if (pending.length === 0) {
    await ctx.editMessageText("✅ No pending reports. All clear!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const lines = pending.slice(0, 5).map((r, i) => {
    const reason = REASON_LABELS[r.reason] ?? r.reason;
    return `${i + 1}. ${reason} — reported ${formatTime(r.createdAt)}`;
  });

  const text = `🚩 Pending reports (${pending.length})\n\n${lines.join("\n")}`;

  const buttons = pending.slice(0, 5).map((r) => [
    inlineButton("✅ Resolve", `mod:resolve:${r.id}`),
    inlineButton("🗑 Delete msg", `mod:delete:${r.id}`),
  ]);

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([...buttons, [inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery(/^mod:resolve:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const reportId = ctx.match![1];
  const store = getBotStore();
  await store.updateReport(reportId, { resolved: true });
  await ctx.editMessageText("✅ Report resolved.", {
    reply_markup: inlineKeyboard([
      [inlineButton("🚩 View Reports", "mod:reports")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^mod:delete:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const reportId = ctx.match![1];
  const store = getBotStore();
  const report = await store.getReport(reportId);
  if (report) {
    await store.updateMessage(report.messageId, { status: "deleted" });
    await store.updateReport(reportId, { resolved: true });
  }
  await ctx.editMessageText("🗑 Message deleted and report resolved.", {
    reply_markup: inlineKeyboard([
      [inlineButton("🚩 View Reports", "mod:reports")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
