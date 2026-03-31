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

// ===== CONFIG =====
const TOKEN = 'MTQ4ODUyNDY4Nzg0MjczODI5Ng.GITj5-.kn-543Z89drU2iWEJWPIKzrKbZIlZuei5l4Zx0'; // Railway
const CLIENT_ID = '1488524687842738296';
const GUILD_ID = '1469406162662195272';

const CANAL_LAVAGEM_ID = '1469409574325850172'; // 💸┃vendas
const CANAL_RANKING_ID = '1469409662997889115'; // 📞┃ranking
// ==================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let dados = {};
if (fs.existsSync('ranking.json')) {
    dados = JSON.parse(fs.readFileSync('ranking.json'));
}

// ===== REGISTRAR COMANDO =====
const commands = [
    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Ver ranking')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
    );
})();

// ===== PAINEL AUTOMÁTICO =====
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
        .setDescription('Clique em uma opção abaixo para iniciar')
        .setColor(0x00ff88);

    await canal.send({
        embeds: [embed],
        components: [row]
    });
});

// ===== INTERAÇÕES =====
client.on('interactionCreate', async interaction => {

    // ===== BOTÕES =====
    if (interaction.isButton()) {

        const modal = new ModalBuilder()
            .setCustomId(interaction.customId)
            .setTitle('💰 Digite o valor');

        const input = new TextInputBuilder()
            .setCustomId('valor')
            .setLabel('Valor da lavagem')
            .setStyle(TextInputStyle.Short);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );

        await interaction.showModal(modal);
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

        const valor = parseFloat(interaction.fields.getTextInputValue('valor'));

        if (isNaN(valor)) {
            return interaction.reply({
                content: '❌ Valor inválido!',
                ephemeral: true
            });
        }

        const taxa = interaction.customId === 'parceria' ? 0.25 : 0.30;

        const aposTaxa = valor * (1 - taxa);
        const lucro = aposTaxa * 0.10;
        const banco = aposTaxa - lucro;

        // salvar ranking
        if (!dados[interaction.user.id]) dados[interaction.user.id] = 0;
        dados[interaction.user.id] += valor;

        fs.writeFileSync('ranking.json', JSON.stringify(dados, null, 2));

        // ===== EMBED LAVAGEM =====
        const embed = new EmbedBuilder()
            .setTitle('💸 Lavagem realizada')
            .setColor(0x00ff88)
            .addFields(
                { name: '👤 Usuário', value: `<@${interaction.user.id}>` },
                { name: '💰 Valor recebido', value: `${valor}` },
                { name: '📉 Taxa aplicada', value: `${taxa * 100}%` },
                { name: '💵 Valor após taxa', value: `${aposTaxa.toFixed(2)}` },
                { name: '🧾 Lucro do lavador (10%)', value: `${lucro.toFixed(2)}` },
                { name: '🏦 Enviado para o banco', value: `${banco.toFixed(2)}` }
            );

        const canal = await client.channels.fetch(CANAL_LAVAGEM_ID);

        const mensagem = await canal.send({ embeds: [embed] });

        // 🧹 apagar mensagem depois de 5 segundos
        setTimeout(() => {
            mensagem.delete().catch(() => {});
        }, 5000);

        await interaction.reply({
            content: '✅ Lavagem registrada!',
            ephemeral: true
        });

        // ===== ATUALIZAR RANKING =====

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

        // limpar mensagens antigas
        const mensagens = await canalRanking.messages.fetch({ limit: 10 });
        await canalRanking.bulkDelete(mensagens).catch(() => {});

        // enviar ranking atualizado
        await canalRanking.send({ embeds: [embedRanking] });
    }

    // ===== /ranking (opcional) =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'ranking') {

        const ranking = Object.entries(dados)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const medals = ['🥇', '🥈', '🥉'];

        const texto = ranking.map((r, i) => {
            const medal = medals[i] || '🏅';
            return `${medal} <@${r[0]}> - 💰 ${r[1]}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📊 Ranking de Lavagem')
            .setColor(0xffd700)
            .setDescription(texto || 'Sem dados');

        const canal = await client.channels.fetch(CANAL_RANKING_ID);
        await canal.send({ embeds: [embed] });

        await interaction.reply({
            content: '📞 Ranking enviado!',
            ephemeral: true
        });
    }

});

client.login(TOKEN);