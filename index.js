const express = require('express');
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(port, () => console.log(`Server running on port ${port}`));

const DATA_FILE = './data.json';
const REMINDER_FILE = './reminder.json';
const RANK_REMINDER_FILE = './rank_reminder.json';

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE)); } catch { return {}; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function loadReminderData() {
  try { return JSON.parse(fs.readFileSync(REMINDER_FILE)); } catch { return {}; }
}
function saveReminderData(data) {
  fs.writeFileSync(REMINDER_FILE, JSON.stringify(data, null, 2));
}
function loadRankReminderData() {
  try { return JSON.parse(fs.readFileSync(RANK_REMINDER_FILE)); } catch { return {}; }
}
function saveRankReminderData(data) {
  fs.writeFileSync(RANK_REMINDER_FILE, JSON.stringify(data, null, 2));
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
      content: `✅ 戦績を更新しました！\n\n📊 成績:\n勝: ${u.W} 負: ${u.L} 分: ${u.D} 合計: ${u.M}\n勝率: ${(u.P * 100).toFixed(2)}%\n\n🎯 ${goal1 * 100}%までに必要勝利数: ${needed1}\n🎯 ${goal2 * 100}%までに必要勝利数: ${needed2}`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'profile') {
    const u = data[userId];
    if (!u) {
      await interaction.reply({ content: '⚠️ データがありません。まず /register を実行してください。', ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `📊 あなたの戦績：\n勝: ${u.W} 負: ${u.L} 分: ${u.D} 合計: ${u.M}\n勝率: ${(u.P * 100).toFixed(2)}%`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'reset') {
    if (!data[userId]) {
      await interaction.reply({ content: '⚠️ あなたの戦績データは存在しません。', ephemeral: true });
      return;
    }

    delete data[userId];
    saveData(data);

    await interaction.reply({ content: '🗑️ 戦績データをリセットしました。', ephemeral: true });
  }

  else if (interaction.commandName === 'help') {
    await interaction.reply({
      content:
        "**📖 使えるコマンド一覧**\n\n" +
        "`/register` - 初期戦績を登録します\n" +
        "`/record` - 今日の戦績を追加し、目標勝率に必要な勝利数を計算\n" +
        "`/profile` - 自分の戦績を表示\n" +
        "`/reset` - 自分の戦績をリセット\n" +
        "`/help` - コマンド一覧を表示\n" +
        "`/remindset` - 戦績リマインダーの設定\n" +
        "`/rankremindset` - ランクマ参加確認リマインダーの設定",
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'remindset') {
    const hour = interaction.options.getInteger('hour');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reminderData = loadReminderData();

    if (hour === -1) {
      delete reminderData[userId];
      saveReminderData(reminderData);
      await interaction.reply({
        content: '🔕 戦績リマインダー通知を無効化しました。',
        ephemeral: true
      });
      return;
    }

    if (hour < 0 || hour > 23) {
      await interaction.reply({
        content: '⚠️ 時間は 0～23 または -1（通知OFF）で指定してください。',
        ephemeral: true
      });
      return;
    }

    reminderData[userId] = {
      hour,
      channelId: channel.id
    };
    saveReminderData(reminderData);

    await interaction.reply({
      content: `✅ 毎日 ${hour}:00 に ${channel.name} で戦績リマインダー通知を送信します！`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'rankremindset') {
    const hour = interaction.options.getInteger('hour');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const rankReminderData = loadRankReminderData();

    if (hour === -1) {
      delete rankReminderData[userId];
      saveRankReminderData(rankReminderData);
      await interaction.reply({
        content: '🔕 ランクマリマインダー通知を無効化しました。',
        ephemeral: true
      });
      return;
    }

    if (hour < 0 || hour > 23) {
      await interaction.reply({
        content: '⚠️ 時間は 0～23 または -1（通知OFF）で指定してください。',
        ephemeral: true
      });
      return;
    }

    rankReminderData[userId] = {
      hour,
      channelId: channel.id
    };
    saveRankReminderData(rankReminderData);

    await interaction.reply({
      content: `✅ 毎日 ${hour}:00 に ${channel.name} でランクマ参加アンケートを送信します！`,
      ephemeral: true
    });
  }
});
// ⏰ 毎分チェックして通知を送信するcron
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentHour = now.getHours();

  // 戦績リマインダー送信
  const reminderData = loadReminderData();
  for (const userId in reminderData) {
    const { hour, channelId } = reminderData[userId];
    if (hour === currentHour) {
      try {
        const channel = await client.channels.fetch(channelId);
        await channel.send(`<@${userId}> 今日の戦績を記録しよう！📝\n/record を忘れずに！`);
      } catch (err) {
        console.error(`⚠️ 通知エラー（戦績 user: ${userId}）：`, err);
      }
    }
  }

  // ランクマリマインダー送信
  const rankReminderData = loadRankReminderData();
  for (const userId in rankReminderData) {
    const { hour, channelId } = rankReminderData[userId];
    if (hour === currentHour) {
      try {
        const channel = await client.channels.fetch(channelId);

        // ボタン作成
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('rank参加')
              .setLabel('✅ 参加')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('rank不参加')
              .setLabel('❌ 不参加')
              .setStyle(ButtonStyle.Danger)
          );

        await channel.send({
          content: `<@${userId}> 本日のランクマに参加しますか？`,
          components: [row]
        });

      } catch (err) {
        console.error(`⚠️ 通知エラー（ランクマ user: ${userId}）：`, err);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
client.on('error', console.error);
process.on('unhandledRejection', console.error);
