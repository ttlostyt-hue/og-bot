const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  Events
} = require("discord.js");

// Read secrets/runtime variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SERVER_URL =
  process.env.SERVER_URL ||
  "http://145.241.253.149:3551/server-status";

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID runtime variable."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Define the slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the Discord bot is online"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check the Fortnite server status"),

  new SlashCommandBuilder()
    .setName("server")
    .setDescription("Show information about the Fortnite server"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show the available bot commands")
].map(command => command.toJSON());

// Register commands in your Discord server
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  console.log("Registering Discord slash commands...");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands registered successfully.");
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Bot online as ${readyClient.user.tag}`);
});

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ping") {
      const websocketPing = Math.round(client.ws.ping);

      await interaction.reply({
        content: `Pong! Bot latency: **${websocketPing} ms**`
      });

      return;
    }

    if (interaction.commandName === "status") {
      // Gives the bot more time to contact the backend
      await interaction.deferReply();

      try {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 8000);

        const response = await fetch(SERVER_URL, {
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }

        const data = await response.json();

        const embed = new EmbedBuilder()
          .setTitle("Star Server Status")
          .setColor(data.online ? 0x22c55e : 0xef4444)
          .addFields(
            {
              name: "Status",
              value: data.online ? "Online" : "Offline",
              inline: true
            },
            {
              name: "Players",
              value: `${data.players ?? 0}/${data.maxPlayers ?? 16}`,
              inline: true
            },
            {
              name: "Version",
              value: String(data.version ?? "Unknown"),
              inline: true
            },
            {
              name: "Map",
              value: String(data.map ?? "Unknown"),
              inline: true
            },
            {
              name: "Mode",
              value: String(data.mode ?? "Unknown"),
              inline: true
            },
            {
              name: "Season",
              value: String(data.season ?? "Unknown"),
              inline: true
            }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("Status command failed:", error);

        await interaction.editReply({
          content:
            "The backend could not be reached. Check that the Oracle server and port 3551 are online."
        });
      }

      return;
    }

    if (interaction.commandName === "server") {
      const embed = new EmbedBuilder()
        .setTitle("Star Project")
        .setDescription("Chapter 5 Season 1 Fortnite project")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Region",
            value: "EU",
            inline: true
          },
          {
            name: "Backend",
            value: "Oracle Cloud",
            inline: true
          },
          {
            name: "Version",
            value: "28.30",
            inline: true
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "help") {
      const embed = new EmbedBuilder()
        .setTitle("Star Bot Commands")
        .setColor(0x3b82f6)
        .setDescription(
          [
            "`/ping` — Check whether the bot is online",
            "`/status` — Check the Fortnite server status",
            "`/server` — Show information about the project",
            "`/help` — Show this command list"
          ].join("\n")
        );

      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Command error:", error);

    const message = {
      content: "An error occurred while running that command.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

async function startBot() {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

startBot();
