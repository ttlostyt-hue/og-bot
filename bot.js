const { Client, GatewayIntentBits } = require('discord.js');

// Give the bot permission to read messages and exist in your server
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// This runs once when the bot successfully turns on
client.once('ready', () => {
  console.log(`✅ SUCCESS! Bot is online and logged in as ${client.user.tag}`);
});

// A simple test command to prove it works
client.on('messageCreate', (message) => {
  // Ignore messages from other bots
  if (message.author.bot) return;

  // If someone types !ping, reply
  if (message.content === '!ping') {
    message.reply('Pong! 🏓 The OG Fortnite bot is active and running in London.');
  }
});

// Log into Discord using your secret token
client.login(process.env.DISCORD_TOKEN);
client.login(process.env.DISCORD_TOKEN);