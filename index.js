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
  console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const data = loadJSON(DATA_FILE);
  const userId = interaction.user.id;

  if (interaction.commandName === 'remindset') {
    const hour = interaction.options.getInteger('hour');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reminders = loadJSON(REMINDER_FILE);

    if (hour === -1) {
      delete reminders[userId];
      saveJSON(REMINDER_FILE, reminders);
      console.log(`🗑️ remindset: ${userId} の通知を無効化`);
      await interaction.reply({ content: '🔕 戦績リマインダー通知を無効化しました。', ephemeral: true });
      return;
    }

    reminders[userId] = { hour: (hour - 9 + 24) % 24, channelId: channel.id };
    console.log(`✅ remindset 登録: ${userId} → ${hour}:00 JST（内部: ${(hour - 9 + 24) % 24} UTC）`);
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
      console.log(`🗑️ rankremindset: ${userId} の通知を無効化`);
      await interaction.reply({ content: '🔕 ランクマリマインダー通知を無効化しました。', ephemeral: true });
      return;
    }

    ranks[userId] = {
      hour: (hour - 9 + 24) % 24,
      channelId: channel.id,
      sentToday: false
    };
    console.log(`✅ rankremindset 登録: ${userId} → ${hour}:00 JST（内部: ${(hour - 9 + 24) % 24} UTC）`);
    saveJSON(RANK_REMINDER_FILE, ranks);
    await interaction.reply({
      content: `✅ 毎日 ${hour}:00 に ${channel.name} でランクマ参加アンケートを送信します！`,
      ephemeral: true
    });
  }
});
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const hour = (now.getHours() + 9) % 24; // JSTに合わせる
  const minute = now.getMinutes();
  console.log(`⏰ cron 実行: 現在 ${hour}:${minute}`);

  const reminders = loadJSON(REMINDER_FILE);
  for (const userId in reminders) {
    const { hour: targetHour, channelId } = reminders[userId];
    console.log(`🔍 remind チェック: user=${userId} 設定=${targetHour}`);

    if (hour === targetHour && minute === 0) {
      try {
        const channel = await client.channels.fetch(channelId);
        await channel.send(`<@${userId}> 今日の戦績を記録しよう！📝\n/record を忘れずに！`);
        console.log(`✅ remind 通知送信成功: user=${userId} → channel=${channelId}`);
      } catch (err) {
        console.error(`❌ remind 通知エラー: user=${userId}`, err);
      }
    }
  }

  const ranks = loadJSON(RANK_REMINDER_FILE);
  for (const userId in ranks) {
    const data = ranks[userId];
    const { hour: targetHour, channelId, lastSent } = data;
    const nowDate = now.toDateString();

    console.log(`🔍 rank チェック: user=${userId} 設定=${targetHour}, sent=${lastSent}`);

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
  
          console.log(`✅ rank 通知送信成功: user=${userId} → channel=${channelId}`);
  
          const participationMap = new Map();
          participationMap.set(message.id, { yes: new Set(), no: new Set() });
  
          client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isButton()) return;
            const choice = interaction.customId;
            const uid = interaction.user.id;
            const record = participationMap.get(interaction.message.id);
            if (!record) return;
  
            if (choice === 'rank参加') {
              record.yes.add(uid);
              record.no.delete(uid);
            } else {
              record.no.add(uid);
              record.yes.delete(uid);
            }
  
            await interaction.reply({
              content: `✅ 「${choice === 'rank参加' ? '参加' : '不参加'}」として記録しました！`,
              ephemeral: true
            });
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
            console.log(`📊 集計完了: message=${message.id}`);
          }, 3 * 60 * 60 * 1000); // 3時間
  
          ranks[userId].lastSent = nowDate;
          saveJSON(RANK_REMINDER_FILE, ranks);
        } catch (err) {
          console.error(`❌ rank 通知エラー: user=${userId}`, err);
        }
      }
    }
  });
  
  client.login(process.env.BOT_TOKEN);
  client.on('error', console.error);
  process.on('unhandledRejection', console.error);
  