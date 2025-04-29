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

// --- Slash Command実装部分 ---
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 既存の calculate コマンド
  if (interaction.commandName === 'calculate') {
    const inputValue = interaction.options.getNumber('value');
    const result = inputValue * 2;
    await interaction.reply(`計算結果は「${result}」です！`);
  }

  // 新規 register コマンド
  if (interaction.commandName === 'register') {
    const winRate = interaction.options.getNumber('win_rate');
    const matches = interaction.options.getInteger('matches');
    const wins = interaction.options.getInteger('wins');

    const losses = wins * (1 - winRate) / winRate;
    const draws = matches - wins - losses;

    const data = loadData();
    data[interaction.user.id] = {
      W: wins,
      L: losses,
      D: draws,
      M: matches,
      P: winRate
    };
    saveData(data);

    await interaction.reply({
      content: `✅ 登録しました！\n勝率: ${winRate}\n勝: ${wins} 負: ${losses.toFixed(2)} 分: ${draws.toFixed(2)}\n合計: ${matches}`,
      ephemeral: true
    });
  }
});

// --- Discordログイン ---
client.login(process.env.BOT_TOKEN);

// --- エラーハンドリング ---
client.on('error', console.error);
process.on('unhandledRejection', console.error);
