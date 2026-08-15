require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

// --- Configuration ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const BACKEND_URL = process.env.BACKEND_URL; // Set to http://132.145.34.204:3551 in Northflank
const BOT_API_KEY = process.env.BOT_API_KEY;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Helper: Fetch with 8s Timeout ---
const fetchWithTimeout = async (url, options = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// --- Command Definitions ---
const commands = [
    // 1. Status Command
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check if the Star game server is online'),

    // 2. Gift Command (Admin Only)
    new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Give every item in the game to a player')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The Star username of the player')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('pack')
                .setDescription('Which items to give')
                .setRequired(true)
                .addChoices(
                    { name: 'Everything (All Skins/Emotes/Pickaxes)', value: 'all_items' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// --- Interaction Handler ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // --- LOGIC: /STATUS ---
    if (commandName === 'status') {
        await interaction.deferReply();
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/server-status`);
            if (!res.ok) throw new Error('Backend returned non-200');
            const data = await res.json();

            const statusEmbed = new EmbedBuilder()
                .setTitle('Star Project | Server Status')
                .setColor(data.online ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: 'Status', value: data.online ? '🟢 ONLINE' : '🔴 OFFLINE', inline: true },
                    { name: 'Players', value: `${data.players || 0}/${data.maxPlayers || 100}`, inline: true },
                    { name: 'Version', value: data.version || '28.30', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });
        } catch (error) {
            await interaction.editReply('❌ **Error:** Could not connect to the Oracle VPS.');
        }
    }

    // --- LOGIC: /GIFT ---
    if (commandName === 'gift') {
        const username = options.getString('username');
        const packName = options.getString('pack');

        // Defer because fetching 10,000+ items from the API takes time
        await interaction.deferReply();

        try {
            const response = await fetchWithTimeout(`${BACKEND_URL}/internal/admin/bulk-gift`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-bot-key': BOT_API_KEY
                },
                // CRITICAL FIX: Added moderatorDiscordId so the backend requireAdmin middleware allows it
                body: JSON.stringify({ 
                    username, 
                    packName,
                    moderatorDiscordId: interaction.user.id 
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Backend request failed');
            }

            const result = await response.json();

            if (result && result.success) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎁 Gifting Successful!')
                    .setDescription(`I have successfully given **${result.count.toLocaleString()} items** to **${username}**!`)
                    .addFields({ name: 'Instruction', value: 'The player must restart their game to see the items.' })
                    .setColor(0x5865F2)
                    .setThumbnail(interaction.user.displayAvatarURL());

                await interaction.editReply({ embeds: [successEmbed] });
            } else {
                const errorReason = result.error || 'The backend refused the request.';
                await interaction.editReply(`❌ **Failed:** ${errorReason}`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ **Critical Error:** The Oracle VPS is unreachable, timed out, or rejected the request.');
        }
    }
});

// --- Startup & Registration ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
        
        client.login(TOKEN);
    } catch (error) {
        console.error('Error during startup:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Star Discord Bot is ready for use.');
});
