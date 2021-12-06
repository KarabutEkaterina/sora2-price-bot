import {Telegraf} from 'telegraf'

const token = '2111425404:AAH3thhtyMmGoP2yqj8rXAXuMmLTmzyeTdY'

const users: Set<number> = new Set()

const bot = new Telegraf(token)

bot.start((ctx) => {
    users.add(ctx.chat.id)

    ctx.reply("You are subscribed to price changes")

    currentPrices.forEach(((value, key) => ctx.telegram.sendMessage(ctx.chat.id, value)))
})

const currentPrices = new Map<string, string>()

bot.command("stop", (ctx) => {
    users.delete(ctx.chat.id)

    ctx.reply("You are unsubscribed from price changes")
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

export async function startBot() {
    console.log("Starting tg bot...");

    await bot.launch()

    console.log("Done.");
}

export function notifyNewPrice(
    token: string,
    newPrice: string,
    pin: boolean
) {
    currentPrices.set(token, newPrice)

    users.forEach((user) => {
        bot.telegram.sendMessage(user, newPrice).then((res) => {
            if (pin) {
                bot.telegram.unpinAllChatMessages(user)
                    .then((_) => bot.telegram.pinChatMessage(user, res.message_id))
            }
        })
    })
}
