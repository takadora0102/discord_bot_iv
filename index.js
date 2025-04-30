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
const RANK_STATUS_FILE = './rank_status.json';

function loadJSON(path) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch {
    return {};
  }
}
function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, c => {
  console.log(`Bot is ready! Logged in as ${c.user.tag}`);
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const data = loadJSON(DATA_FILE);
  const userId = interaction.user.id;

  if (interaction.commandName === 'register') {
    const winRate = interaction.options.getNumber('win_rate');
    const matches = interaction.options.getInteger('matches');
    const wins = interaction.options.getInteger('wins');
    const losses = wins * (1 - winRate) / winRate;
    const draws = matches - wins - losses;
    data[userId] = { W: wins, L: losses, D: draws, M: matches, P: winRate };
    saveJSON(DATA_FILE, data);
    await interaction.reply({
      content: `✅ 登録しました！\n勝率: ${winRate}\n勝: ${wins} 負: ${losses.toFixed(2)} 分: ${draws.toFixed(2)}\n合計: ${matches}`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'record') {
    if (!data[userId]) {
      await interaction.reply({ content: '⚠️ まだ初期登録がされていません。まず /register を使ってください！', ephemeral: true });
      return;
    }
    const w1 = interaction.options.getInteger('wins_today');
    const l1 = interaction.options.getInteger('losses_today');
    const d1 = interaction.options.getInteger('draws_today');
    const goal1 = interaction.options.getNumber('goal_win_rate1');
    const goal2 = interaction.options.getNumber('goal_win_rate2');
    const u = data[userId];
    u.W += w1; u.L += l1; u.D += d1;
    u.M = u.W + u.L + u.D;
    u.P = u.W / (u.W + u.L);
    function calcNeededWins(goal) {
      const total = u.W + u.L;
      const needed = Math.ceil((goal * total - u.W) / (1 - goal));
      return needed > 0 ? needed : 0;
    }
    const needed1 = calcNeededWins(goal1);
    const needed2 = calcNeededWins(goal2);
    saveJSON(DATA_FILE, data);
    await interaction.reply({
      content:
        `✅ 戦績を更新しました！\n\n📊 成績:\n勝: ${u.W} 負: ${u.L} 分: ${u.D} 合計: ${u.M}\n勝率: ${(u.P * 100).toFixed(2)}%\n\n` +
        `🎯 ${goal1 * 100}%までに必要勝利数: ${needed1}\n🎯 ${goal2 * 100}%までに必要勝利数: ${needed2}`,
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
    delete data[userId];
    saveJSON(DATA_FILE, data);
    await interaction.reply({ content: '🗑️ 戦績データをリセットしました。', ephemeral: true });
  }

  else if (interaction.commandName === 'remindset') {
    const hour = interaction.options.getInteger('hour');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reminders = loadJSON(REMINDER_FILE);

    if (hour === -1) {
      delete reminders[userId];
      saveJSON(REMINDER_FILE, reminders);
      await interaction.reply({ content: '🔕 戦績リマインダー通知を無効化しました。', ephemeral: true });
      return;
    }

    reminders[userId] = { hour: (hour - 9 + 24) % 24, channelId: channel.id };
    saveJSON(REMINDER_FILE, reminders);
    await interaction.reply({
      content: `✅ 毎日 ${hour}:00 に ${channel.name} で戦績リマインダー通知を送信します！`,
      ephemeral: true
    });
  }

  else if (interaction.commandName === 'rankremindset') {
    const hour = interaction.options.getInteger('hour');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const ranks = loadJSON(RANK_REMINDER_FILE);

    if (hour === -1) {
      delete ranks[userId];
      saveJSON(RANK_REMINDER_FILE, ranks);
      await interaction.reply({ content: '🔕 ランクマリマインダー通知を無効化しました。', ephemeral: true });
      return;
    }

    ranks[userId] = { hour: (hour - 9 + 24) % 24, channelId: channel.id, sentToday: false };
    saveJSON(RANK_REMINDER_FILE, ranks);
    await interaction.reply({
      content: `✅ 毎日 ${hour}:00 に ${channel.name} でランクマ参加アンケートを送信します！`,
      ephemeral: true
    });
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
        "`/remindset` - 戦績リマインダーの設定（個人メンション）\n" +
        "`/rankremindset` - ランクマ参加アンケートの設定（@everyone、3時間後に集計）",
      ephemeral: true
    });
  }
});
// 🔁 ボタンの応答保存用
const participationMap = new Map();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;
  const choice = interaction.customId; // 'rank参加' or 'rank不参加'

  if (!participationMap.has(interaction.message.id)) {
    participationMap.set(interaction.message.id, { yes: new Set(), no: new Set() });
  }

  const record = participationMap.get(interaction.message.id);
  if (choice === 'rank参加') {
    record.yes.add(userId);
    record.no.delete(userId);
  } else {
    record.no.add(userId);
    record.yes.delete(userId);
  }

  await interaction.reply({ content: `✅ 「${choice === 'rank参加' ? '参加' : '不参加'}」として記録しました！`, ephemeral: true });
});

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 戦績リマインダー
  const reminders = loadJSON(REMINDER_FILE);
  for (const userId in reminders) {
    const { hour: targetHour, channelId } = reminders[userId];
    if (hour === targetHour && minute === 0) {
      try {
        const channel = await client.channels.fetch(channelId);
        await channel.send(`<@${userId}> 今日の戦績を記録しよう！📝\n/record を忘れずに！`);
      } catch (err) {
        console.error(`⚠️ 通知エラー（戦績 user: ${userId}）：`, err);
      }
    }
  }

  // ランクマリマインダー
  const ranks = loadJSON(RANK_REMINDER_FILE);
  for (const userId in ranks) {
    const data = ranks[userId];
    const { hour: targetHour, channelId, lastSent } = data;
    const nowDate = now.toDateString();

    if (hour === targetHour && minute === 0 && lastSent !== nowDate) {
      try {
        const channel = await client.channels.fetch(channelId);
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder().setCustomId('rank参加').setLabel('✅ 参加').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('rank不参加').setLabel('❌ 不参加').setStyle(ButtonStyle.Danger)
          );

        const message = await channel.send({
          content: `@everyone 本日のランクマに参加しますか？`,
          components: [row]
        });

        // 3時間後に集計
        setTimeout(async () => {
          const record = participationMap.get(message.id);
          if (!record) return;

          const yesList = [...record.yes].map(id => `<@${id}>`).join('\n') || '（なし）';
          const noList = [...record.no].map(id => `<@${id}>`).join('\n') || '（なし）';
          await channel.send(
            `✅ **ランクマ参加状況（集計結果）**\n\n【参加】\n${yesList}\n\n【不参加】\n${noList}`
          );
          participationMap.delete(message.id);
        }, 3 * 60 * 60 * 1000); // 3時間

        ranks[userId].lastSent = nowDate;
        saveJSON(RANK_REMINDER_FILE, ranks);
      } catch (err) {
        console.error(`⚠️ 通知エラー（ランクマ user: ${userId}）：`, err);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
client.on('error', console.error);
process.on('unhandledRejection', console.error);
