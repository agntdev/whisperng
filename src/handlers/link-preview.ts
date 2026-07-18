import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getBotStore } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

function linkText(username: string, token: string): string {
  return (
    `🔗 Your anonymous link\n\n` +
    `Share this link so anyone can send you anonymous messages:\n\n` +
    `https://t.me/${username}?start=${token}\n\n` +
    `Anyone who opens this link can message you without revealing who they are.`
  );
}

composer.callbackQuery("link:preview", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getBotStore();
  const user = await store.getUser(ctx.from!.id);
  if (!user) {
    await ctx.editMessageText("Something went wrong. Tap /start to try again.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  const username = (ctx as any).botInfo?.username ?? "bot";
  await ctx.editMessageText(linkText(username, user.anonymousToken), {
    reply_markup: inlineKeyboard([
      [inlineButton("📋 Copy link", `link:copy:${user.anonymousToken}`)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^link:copy:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Link copied!" });
});

export default composer;
