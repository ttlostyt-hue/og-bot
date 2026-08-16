require('dotenv').config();
const { 
    Client, GatewayIntentBits, REST, Routes, 
    SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const BACKEND_URL = process.env.BACKEND_URL; 
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
    new SlashCommandBuilder().setName('status').setDescription('Check if the Star game server is online'),
    
    new SlashCommandBuilder().setName('link').setDescription('Link your Discord account to your Star account')
        .addStringOption(o => o.setName('code').setDescription('The 8-character code from the launcher').setRequired(true)),
        
    new SlashCommandBuilder().setName('exchange-code').setDescription('Get a 5-minute login code for the game'),
    
    new SlashCommandBuilder().setName('details').setDescription('View your linked Star account details'),

    new SlashCommandBuilder().setName('ban').setDescription('Ban a player (Admin Only)')
        .addStringOption(o => o.setName('username').setDescription('Star username').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for ban').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder().setName('unban').setDescription('Unban a player (Admin Only)')
        .addStringOption(o => o.setName('username').setDescription('Star username').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder().setName('gift').setDescription('Give items to a username (Admin Only)')
        .addStringOption(o => o.setName('username').setDescription('Star username').setRequired(true))
        .addStringOption(o => o.setName('pack').setDescription('Item pack').setRequired(true).addChoices({ name: 'All Items', value: 'all_items' }))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder().setName('gift-id').setDescription('Give items to a linked Discord ID (Admin Only)')
        .addStringOption(o => o.setName('discord_id').setDescription('Target Discord User ID').setRequired(true))
        .addStringOption(o => o.setName('pack').setDescription('Item pack').setRequired(true).addChoices({ name: 'All Items', value: 'all_items' }))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// --- Interaction Handler ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;

    // --- 1. STATUS ---
    if (commandName === 'status') {
        await interaction.deferReply();
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/server-status`);
            const data = await res.json();
            const embed = new EmbedBuilder()
                .setTitle('Star Project | Server Status')
                .setColor(data.online ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: 'Status', value: data.online ? '🟢 ONLINE' : '🔴 OFFLINE', inline: true },
                    { name: 'Players', value: `${data.players || 0}/${data.maxPlayers || 100}`, inline: true },
                    { name: 'Version', value: data.version || '28.30', inline: true }
                ).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch { await interaction.editReply('❌ **Error:** Could not connect to the Oracle VPS.'); }
    }

    // --- 2. LINK ---
    if (commandName === 'link') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/internal/discord/link`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-key': BOT_API_KEY },
                body: JSON.stringify({ discordId: interaction.user.id, code: options.getString('code') })
            });
            const result = await res.json();
            if (res.ok && result.success) await interaction.editReply(`✅ **Success!** Linked to Star account **${result.username}**.`);
            else await interaction.editReply(`❌ **Failed:** ${result.message || 'Invalid or used code.'}`);
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable.'); }
    }

    // --- 3. EXCHANGE CODE ---
    if (commandName === 'exchange-code') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/internal/discord/exchange-code`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-key': BOT_API_KEY },
                body: JSON.stringify({ discordId: interaction.user.id })
            });
            const result = await res.json();
            if (res.ok) {
                await interaction.editReply(`🔑 **Your Login Code:**\n||${result.code}||\n\n*Paste this into the launcher. Expires in 5 minutes. DO NOT SHARE THIS.*`);
            } else {
                await interaction.editReply(`❌ **Failed:** ${result.message || 'Is your Discord linked?'}`);
            }
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable.'); }
    }

    // --- 4. DETAILS ---
    if (commandName === 'details') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/internal/discord/account/${interaction.user.id}`, {
                headers: { 'x-bot-key': BOT_API_KEY }
            });
            if (res.status === 404) {
                return await interaction.editReply('❌ **Not Linked:** Use `/link` to connect your Star account first.');
            }
            const acc = await res.json();
            const embed = new EmbedBuilder()
                .setTitle('📊 Account Details')
                .setColor(0x5865F2)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: 'Username', value: acc.username, inline: true },
                    { name: 'Account ID', value: acc.accountId, inline: true },
                    { name: 'Status', value: acc.banned ? `🔴 BANNED (${acc.banReason})` : '🟢 Active', inline: false },
                    { name: 'Items Owned', value: `${acc.items?.length || 0}`, inline: true }
                ).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable.'); }
    }

    // --- 5. BAN (Admin) ---
    if (commandName === 'ban') {
        await interaction.deferReply();
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/internal/admin/ban`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-key': BOT_API_KEY },
                body: JSON.stringify({ username: options.getString('username'), reason: options.getString('reason'), moderatorDiscordId: interaction.user.id })
            });
            const result = await res.json();
            if (res.ok) await interaction.editReply(`🔨 **Banned:** ${result.message}`);
            else await interaction.editReply(`❌ **Failed:** ${result.message}`);
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable or permission denied.'); }
    }

    // --- 6. UNBAN (Admin) ---
    if (commandName === 'unban') {
        await interaction.deferReply();
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/internal/admin/unban`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-key': BOT_API_KEY },
                body: JSON.stringify({ username: options.getString('username'), moderatorDiscordId: interaction.user.id })
            });
            const result = await res.json();
            if (res.ok) await interaction.editReply(`✅ **Unbanned:** ${result.message}`);
            else await interaction.editReply(`❌ **Failed:** ${result.message}`);
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable or permission denied.'); }
    }

    // --- 7. GIFT (Admin) ---
    if (commandName === 'gift') {
        await interaction.deferReply();
        try {
            const res = await fetchWithTimeout(`${BACKEND_URL}/internal/admin/bulk-gift`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-key': BOT_API_KEY },
                body: JSON.stringify({ username: options.getString('username'), packName: options.getString('pack'), moderatorDiscordId: interaction.user.id })
            });
            const result = await res.json();
            if (res.ok && result.success) await interaction.editReply(`🎁 **Success:** Gave **${result.count.toLocaleString()} items** to **${options.getString('username')}**!`);
            else await interaction.editReply(`❌ **Failed:** ${result.message || 'User not found.'}`);
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable or permission denied.'); }
    }

    // --- 8. GIFT-ID (Admin) ---
    if (commandName === 'gift-id') {
        await interaction.deferReply();
        const targetId = options.getString('discord_id');
        try {
            // First, find the username linked to this Discord ID
            const accRes = await fetchWithTimeout(`${BACKEND_URL}/internal/discord/account/${targetId}`, { headers: { 'x-bot-key': BOT_API_KEY } });
            if (accRes.status === 404) return await interaction.editReply('❌ **Failed:** That Discord ID is not linked to any Star account.');
            const acc = await accRes.json();

            // Then, gift the items to that username
            const giftRes = await fetchWithTimeout(`${BACKEND_URL}/internal/admin/bulk-gift`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-key': BOT_API_KEY },
                body: JSON.stringify({ username: acc.username, packName: options.getString('pack'), moderatorDiscordId: interaction.user.id })
            });
            const result = await giftRes.json();
            if (giftRes.ok && result.success) await interaction.editReply(`🎁 **Success:** Gave **${result.count.toLocaleString()} items** to <@${targetId}> (**${acc.username}**)!`);
            else await interaction.editReply(`❌ **Failed:** ${result.message}`);
        } catch { await interaction.editReply('❌ **Error:** VPS unreachable or permission denied.'); }
    }
});

// --- Startup & Registration ---
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
        client.login(TOKEN);
    } catch (error) { console.error('Error during startup:', error); }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Star Discord Bot is ready for use.');
});
