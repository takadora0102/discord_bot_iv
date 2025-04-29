const express = require('express');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const DATA_FILE = './data.json';

app.get('/', (req, res) => {
  res.send('Bot is running!');
});
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

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

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const data = loadData();
  const userId = interaction.user.id;

  if (interaction.commandName === 'register') {
    const winRate = interaction.options.getNumber('win_rate');
    const matches = interaction.options.getInteger('matches');
    const wins = interaction.options.getInteger('wins');
    const losses = wins * (1 - winRate) / winRate;
    const draws = matches - wins - losses;

    data[userId] = { W: wins, L: losses, D: draws, M: matches, P: winRate };
    saveData(data);

    await interaction.reply({
      content: `✅ 登録しました！\n勝率: ${winRate}\n勝: ${wins} 負: ${losses.toFixed(2)} 分: ${draws.toFixed(2)}\n合計: ${matches}`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'record') {
    if (!data[userId]) {
      await interaction.reply({
        content: '⚠️ まだ初期登録がされていません。まず /register を使ってください！',
        ephemeral: true
      });
      return;
    }

    const w1 = interaction.options.getInteger('wins_today');
    const l1 = interaction.options.getInteger('losses_today');
    const d1 = interaction.options.getInteger('draws_today');
    const goal1 = interaction.options.getNumber('goal_win_rate1');
    const goal2 = interaction.options.getNumber('goal_win_rate2');

    const u = data[userId];
    u.W += w1;
    u.L += l1;
    u.D += d1;
    u.M = u.W + u.L + u.D;
    u.P = u.W / (u.W + u.L);

    function calcNeededWins(goal) {
      const total = u.W + u.L;
      const needed = Math.ceil((goal * total - u.W) / (1 - goal));
      return needed > 0 ? needed : 0;
    }

    const needed1 = calcNeededWins(goal1);
    const needed2 = calcNeededWins(goal2);

    saveData(data);

    await interaction.reply({
      content: `✅ 戦績を更新しました！\n\n`
        + `📊 現在の成績:\n`
        + `勝: ${u.W} 負: ${u.L} 分: ${u.D} 合計: ${u.M}\n`
        + `勝率: ${(u.P * 100).toFixed(2)}%\n\n`
        + `🎯 勝率 ${goal1 * 100}% に必要な追加勝利数: ${needed1}\n`
        + `🎯 勝率 ${goal2 * 100}% に必要な追加勝利数: ${needed2}`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'profile') {
    const u = data[userId];

    if (!u) {
      await interaction.reply({
        content: '⚠️ 戦績が登録されていません。まず /register を使ってください！',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `📊 あなたの戦績：\n`
        + `勝: ${u.W} 負: ${u.L} 分: ${u.D} 合計: ${u.M}\n`
        + `勝率: ${(u.P * 100).toFixed(2)}%`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'reset') {
    if (!data[userId]) {
      await interaction.reply({
        content: '⚠️ あなたの戦績データは存在しません。',
        ephemeral: true
      });
      return;
    }

    delete data[userId];
    saveData(data);

    await interaction.reply({
      content: '🗑️ あなたの戦績データをリセットしました。',
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'help') {
    await interaction.reply({
      content:
        "**📖 使えるコマンド一覧**\n\n" +
        "`/register` - 初期戦績を登録します（勝率・試合数・勝利数）\n" +
        "`/record` - 日々の戦績を追加し、目標勝率までの必要勝利数を計算します\n" +
        "`/profile` - あなたの現在の戦績を表示します\n" +
        "`/reset` - あなたの戦績データを初期化します\n" +
        "`/help` - このヘルプを表示します",
      ephemeral: true
    });
  }
});

client.login(process.env.BOT_TOKEN);
client.on('error', console.error);
process.on('unhandledRejection', console.error);
