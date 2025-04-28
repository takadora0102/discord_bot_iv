const express = require('express');
const { Client, GatewayIntentBits, Events } = require('discord.js');

const app = express();
const port = process.env.PORT || 3000;

// Expressサーバー（Railway用）
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// Discord Bot本体
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
  console.log(`Bot is ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'calculate') {
    const inputValue = interaction.options.getNumber('value');

    const result = inputValue * 2;

    await interaction.reply(`計算結果は「${result}」です！`);
  }
});

client.login(process.env.BOT_TOKEN);
