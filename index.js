const express = require('express');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const DATA_FILE = './data.json';

// --- Expressサーバー（Render用） ---
app.get('/', (req, res) => {
  res.send('Bot is running!');
});
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// --- JSONファイル読み書き関数 ---
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Discord Bot設定 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, c => {
  console.log(`Bot is ready! Logged in as ${c.user.tag}`);
});

// --- Slash Command 実装予定箇所（例: register, record） ---
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'calculate') {
    const inputValue = interaction.options.getNumber('value');
    const result = inputValue * 2;
    await interaction.reply(`計算結果は「${result}」です！`);
  }

  // 👇 register コマンドや record コマンドはここに追加予定！
});

// --- Discordログイン ---
client.login(process.env.BOT_TOKEN);

// --- エラー補足 ---
client.on('error', console.error);
process.on('unhandledRejection', console.error);
