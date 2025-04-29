const express = require('express');
const { Client, GatewayIntentBits, Events } = require('discord.js');

const app = express();
const port = process.env.PORT || 3000;

// --- Expressサーバー起動（Renderのため必要） ---
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// --- Discord BOT起動部分 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,            // サーバーの情報取得
    GatewayIntentBits.GuildMessages,     // メッセージ受信
    GatewayIntentBits.MessageContent     // メッセージ本文の取得
  ]
});

// Botが起動したらコンソールにログを出す
client.once(Events.ClientReady, c => {
  console.log(`Bot is ready! Logged in as ${c.user.tag}`);
});

// コマンドを受け取ったときの動き
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'calculate') {
    const inputValue = interaction.options.getNumber('value');

    const result = inputValue * 2;

    await interaction.reply(`計算結果は「${result}」です！`);
  }
});

// Discordへログイン
client.login(process.env.BOT_TOKEN);

// エラーハンドリング（Botが落ちないため）
client.on('error', console.error);
process.on('unhandledRejection', console.error);
