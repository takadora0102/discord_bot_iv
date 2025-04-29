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

// --- JSON読み書き ---
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

// --- Discord BOTクライアント ---
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

// --- コマンド処理 ---
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /register
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

  // /record
  if (interaction.commandName === 'record') {
    const winsToday = interaction.options.getInteger('wins_today');
    const lossesToday = interaction.options.getInteger('losses_today');
    const drawsToday = interaction.options.getInteger('draws_today');
    const goalWinRate1 = interaction.options.getNumber('goal_win_rate1');
    const goalWinRate2 = interaction.options.getNumber('goal_win_rate2');

    const data = loadData();
    const userData = data[interaction.user.id];

    if (!userData) {
      await interaction.reply({
        content: '⚠️ まだ初期登録がされていません。まず /register を使ってください！',
        ephemeral: true
      });
      return;
    }

    userData.W += winsToday;
    userData.L += lossesToday;
    userData.D += drawsToday;
    userData.M = userData.W + userData.L + userData.D;
    userData.P = userData.W / (userData.W + userData.L);

    function calcNeededWins(goalWinRate) {
      const W = userData.W;
      const L = userData.L;
      const total = W + L;
      const needed = Math.ceil((goalWinRate * total - W) / (1 - goalWinRate));
      return needed > 0 ? needed : 0;
    }

    const neededWins1 = calcNeededWins(goalWinRate1);
    const neededWins2 = calcNeededWins(goalWinRate2);

    saveData(data);

    await interaction.reply({
      content: `✅ 戦績を更新しました！\n\n`
        + `📝 現在の成績:\n`
        + `勝ち: ${userData.W}\n負け: ${userData.L}\n引き分け: ${userData.D}\n合計試合数: ${userData.M}\n勝率: ${(userData.P * 100).toFixed(2)}%\n\n`
        + `🎯 目標勝率 ${goalWinRate1 * 100}% に必要な追加勝利数: ${neededWins1}\n`
        + `🎯 目標勝率 ${goalWinRate2 * 100}% に必要な追加勝利数: ${neededWins2}`,
      ephemeral: true
    });
  }

  // /profile
  if (interaction.commandName === 'profile') {
    const data = loadData();
    const userData = data[interaction.user.id];

    if (!userData) {
      await interaction.reply({
        content: '⚠️ 戦績データが登録されていません。\nまず /register で初期登録をしてください！',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `📊 あなたの戦績：\n`
        + `勝ち: ${userData.W}\n負け: ${userData.L}\n引き分け: ${userData.D}\n合計: ${userData.M}\n勝率: ${(userData.P * 100).toFixed(2)}%`,
      ephemeral: true
    });
  }

  // /reset
  if (interaction.commandName === 'reset') {
    const data = loadData();

    if (!data[interaction.user.id]) {
      await interaction.reply({
        content: '⚠️ あなたの戦績データは存在しません。',
        ephemeral: true
      });
      return;
    }

    delete data[interaction.user.id];
    saveData(data);

    await interaction.reply({
      content: '🗑️ あなたの戦績データをリセットしました。',
      ephemeral: true
    });
  }
});

// --- Discordログイン & エラーハンドリング ---
client.login(process.env.BOT_TOKEN);
client.on('error', console.error);
process.on('unhandledRejection', console.error);
