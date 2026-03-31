const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');

const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CANAL_LAVAGEM_ID = process.env.CANAL_LAVAGEM_ID;
const CANAL_RANKING_ID = process.env.CANAL_RANKING_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error('❌ Variáveis não configuradas!');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let dados = {};
if (fs.existsSync('ranking.json')) {
    dados = JSON.parse(fs.readFileSync('ranking.json'));
}

const commands = [
    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Ver ranking')
        .setDMPermission(false)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('✅ Comandos registrados');
    } catch (err) {
        console.error(err);
    }
})();

client.once('clientReady', async () => {
    console.log(`🤖 Bot online como ${client.user.tag}`);

    const canal = await client.channels.fetch(CANAL_LAVAGEM_ID);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('parceria')
            .setLabel('🤝 Com parceria (25%)')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('sem_parceria')
            .setLabel('💼 Sem parceria (30%)')
            .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
        .setTitle('💸 Sistema de Lavagem')
        .setDescription('Clique abaixo para iniciar')
        .setColor(0x00ff88);

    canal.send({ embeds: [embed], components: [row] });
});

client.on('interactionCreate', async interaction => {

    if (interaction.isButton()) {
        const modal = new ModalBuilder()
            .setCustomId(interaction.customId)
            .setTitle('💰 Valor da lavagem');

        const input = new TextInputBuilder()
            .setCustomId('valor')
            .setLabel('Digite o valor')
            .setStyle(TextInputStyle.Short);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {

        const valor = parseFloat(interaction.fields.getTextInputValue('valor'));

        if (isNaN(valor)) {
            return interaction.reply({ content: '❌ Valor inválido!', ephemeral: true });
        }

        const taxa = interaction.customId === 'parceria' ? 0.25 : 0.30;
        const aposTaxa = valor * (1 - taxa);
        const lucro = aposTaxa * 0.10;
        const banco = aposTaxa - lucro;

        if (!dados[interaction.user.id]) dados[interaction.user.id] = 0;
        dados[interaction.user.id] += valor;

        fs.writeFileSync('ranking.json', JSON.stringify(dados, null, 2));

        const embed = new EmbedBuilder()
            .setTitle('💸 Lavagem realizada')
            .setColor(0x00ff88)
            .addFields(
                { name: '👤 Usuário', value: `<@${interaction.user.id}>` },
                { name: '💰 Valor', value: `${valor}` },
                { name: '📉 Taxa', value: `${taxa * 100}%` },
                { name: '💵 Após taxa', value: `${aposTaxa.toFixed(2)}` },
                { name: '🧾 Lucro', value: `${lucro.toFixed(2)}` },
                { name: '🏦 Banco', value: `${banco.toFixed(2)}` }
            );

        const canal = await client.channels.fetch(CANAL_LAVAGEM_ID);
        const msg = await canal.send({ embeds: [embed] });

        setTimeout(() => msg.delete().catch(() => {}), 5000);

        await interaction.reply({
            content: '✅ Lavagem registrada!',
            ephemeral: true
        });

        const ranking = Object.entries(dados)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const medals = ['🥇', '🥈', '🥉'];

        const texto = ranking.map((r, i) => {
            const medal = medals[i] || '🏅';
            return `${medal} <@${r[0]}> - 💰 ${r[1]}`;
        }).join('\n');

        const embedRanking = new EmbedBuilder()
            .setTitle('📊 Ranking de Lavagem')
            .setColor(0xffd700)
            .setDescription(texto || 'Sem dados');

        const canalRanking = await client.channels.fetch(CANAL_RANKING_ID);

        const mensagens = await canalRanking.messages.fetch({ limit: 10 });
        await canalRanking.bulkDelete(mensagens).catch(() => {});

        canalRanking.send({ embeds: [embedRanking] });
    }
});

client.login(TOKEN);
