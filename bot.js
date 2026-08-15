// ... (Keep existing setup code)

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Server Status'),
    new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Give items to a player')
        .addStringOption(o => o.setName('username').setDescription('Target player').setRequired(true))
        .addStringOption(o => o.setName('pack').setDescription('Item pack').setRequired(true)
            .addChoices(
                { name: 'Everything (ALL ITEMS)', value: 'all_items' },
                { name: 'Test Pack (1 Item)', value: 'test_pack' }
            )),
].map(c => c.toJSON());

// ... (Inside interactionCreate)
    if (interaction.commandName === 'gift') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'Admins only!', ephemeral: true });
        }

        await interaction.deferReply();
        const username = interaction.options.getString('username');
        const packName = interaction.options.getString('pack');

        try {
            const res = await fetch(`${process.env.BACKEND_URL}/internal/admin/bulk-gift`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Bot-Key': process.env.BOT_API_KEY },
                body: JSON.stringify({ username, packName })
            });

            const data = await res.json();
            if (data && data.success) {
                await interaction.editReply(`✅ Successfully gave **${data.count} items** (THE ENTIRE GAME) to **${username}**!`);
            } else {
                await interaction.editReply(`❌ Error: ${data.error || "Backend failed"}`);
            }
        } catch (e) {
            await interaction.editReply('❌ Oracle VPS is unreachable.');
        }
    }
// ... (Rest of the bot.js)
