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
    EmbedBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CANAL_VENDAS_ID = process.env.CANAL_LAVAGEM_ID;
const CANAL_LOGS_ID = process.env.CANAL_RANKING_ID;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ===== Persistência simples =====
let pedidos = {};
let ranking = {};
let contador = 1;

if (fs.existsSync("ranking.json")) {
    ranking = JSON.parse(fs.readFileSync("ranking.json"));
}

function salvarRanking() {
    fs.writeFileSync("ranking.json", JSON.stringify(ranking, null, 2));
}

// ===== Tabela de preços =====
const tabela = {
    Parceiro: {
        Pistola: 150,
        Sub: 250,
        Rifle: 400,
        Escopeta: 500
    },
    Pista: {
        Pistola: 200,
        Sub: 300,
        Rifle: 450,
        Escopeta: 600
    }
};

// ===== Slash commands =====
const commands = [
    new SlashCommandBuilder()
        .setName("painel")
        .setDescription("Enviar painel de vendas")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log("✅ Slash Commands registrados");
    } catch (err) {
        console.error(err);
    }
})();

client.once("ready", () => {
    console.log(`🤖 ${client.user.tag} Online`);
});

client.on("interactionCreate", async (interaction) => {

    // ===== /painel =====
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "painel") {
            const embed = new EmbedBuilder()
                .setColor("#2B2D31")
                .setTitle("💣 MARROKAN STORE")
                .setDescription(`
# Sistema de vendas
Clique no botão abaixo para criar um pedido.
━━━━━━━━━━━━━━━━━━━━━━━
🟢 Atendimento Automático
💣 Entrega rápida
📦 Estoque atualizado
━━━━━━━━━━━━━━━━━━━━━━━
`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("novoPedido")
                    .setLabel("🛒 Fazer Pedido")
                    .setStyle(ButtonStyle.Success)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }
        return;
    }

    // ===== Botão: iniciar pedido -> escolher categoria =====
    if (interaction.isButton() && interaction.customId === "novoPedido") {
        const menu = new StringSelectMenuBuilder()
            .setCustomId("escolherCategoria")
            .setPlaceholder("Selecione a categoria")
            .addOptions(
                Object.keys(tabela).map(categoria => ({
                    label: categoria,
                    value: categoria
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
            content: "Escolha a categoria do pedido:",
            components: [row],
            ephemeral: true
        });
    }

    // ===== Select: categoria -> escolher arma =====
    if (interaction.isStringSelectMenu() && interaction.customId === "escolherCategoria") {
        const categoria = interaction.values[0];
        const armas = tabela[categoria];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`escolherArma_${categoria}`)
            .setPlaceholder("Selecione o item")
            .addOptions(
                Object.entries(armas).map(([nome, preco]) => ({
                    label: `${nome} - $${preco}`,
                    value: nome
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.update({
            content: `Categoria: **${categoria}**\nAgora escolha o item:`,
            components: [row]
        });
    }

    // ===== Select: arma -> abrir modal de quantidade =====
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("escolherArma_")) {
        const categoria = interaction.customId.split("_")[1];
        const arma = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`modalQuantidade_${categoria}_${arma}`)
            .setTitle(`Pedido - ${arma}`);

        const inputQuantidade = new TextInputBuilder()
            .setCustomId("quantidade")
            .setLabel("Quantidade")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex: 1")
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputQuantidade)
        );

        return interaction.showModal(modal);
    }

    // ===== Modal: confirmar quantidade -> criar pedido =====
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modalQuantidade_")) {
        const [, categoria, arma] = interaction.customId.split("_");
        const quantidadeRaw = interaction.fields.getTextInputValue("quantidade");
        const quantidade = parseInt(quantidadeRaw, 10);

        if (isNaN(quantidade) || quantidade <= 0) {
            return interaction.reply({
                content: "❌ Quantidade inválida. Use apenas números maiores que 0.",
                ephemeral: true
            });
        }

        const precoUnitario = tabela[categoria][arma];
        const total = precoUnitario * quantidade;
        const pedidoId = contador++;

        pedidos[pedidoId] = {
            id: pedidoId,
            cliente: interaction.user.id,
            categoria,
            arma,
            quantidade,
            total,
            status: "pendente"
        };

        const embed = new EmbedBuilder()
            .setColor("#2B2D31")
            .setTitle(`🧾 Pedido #${pedidoId}`)
            .addFields(
                { name: "Cliente", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Categoria", value: categoria, inline: true },
                { name: "Item", value: arma, inline: true },
                { name: "Quantidade", value: `${quantidade}`, inline: true },
                { name: "Total", value: `$${total}`, inline: true },
                { name: "Status", value: "🟡 Pendente", inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`entregarPedido_${pedidoId}`)
                .setLabel("✅ Marcar como entregue")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancelarPedido_${pedidoId}`)
                .setLabel("❌ Cancelar pedido")
                .setStyle(ButtonStyle.Danger)
        );

        const canalVendas = await client.channels.fetch(CANAL_VENDAS_ID).catch(() => null);
        if (canalVendas) {
            await canalVendas.send({ embeds: [embed], components: [row] });
        }

        return interaction.reply({
            content: `✅ Pedido criado com sucesso! Total: **$${total}**`,
            ephemeral: true
        });
    }

    // ===== Botão: marcar pedido como entregue =====
    if (interaction.isButton() && interaction.customId.startsWith("entregarPedido_")) {
        const pedidoId = interaction.customId.split("_")[1];
        const pedido = pedidos[pedidoId];

        if (!pedido) {
            return interaction.reply({ content: "Pedido não encontrado.", ephemeral: true });
        }

        if (pedido.status === "entregue") {
            return interaction.reply({ content: "Esse pedido já foi entregue.", ephemeral: true });
        }

        pedido.status = "entregue";

        // Atualiza ranking do vendedor (quem clicou no botão)
        const vendedorId = interaction.user.id;
        if (!ranking[vendedorId]) {
            ranking[vendedorId] = { vendas: 0, total: 0 };
        }
        ranking[vendedorId].vendas += 1;
        ranking[vendedorId].total += pedido.total;
        salvarRanking();

        const embedAtualizado = EmbedBuilder.from(interaction.message.embeds[0])
            .spliceFields(5, 1, { name: "Status", value: `🟢 Entregue por <@${vendedorId}>`, inline: true });

        await interaction.update({ embeds: [embedAtualizado], components: [] });

        const canalLogs = await client.channels.fetch(CANAL_LOGS_ID).catch(() => null);
        if (canalLogs) {
            canalLogs.send(
                `📦 Pedido #${pedidoId} entregue por <@${vendedorId}> — Total: $${pedido.total}`
            );
        }

        return;
    }

    // ===== Botão: cancelar pedido =====
    if (interaction.isButton() && interaction.customId.startsWith("cancelarPedido_")) {
        const pedidoId = interaction.customId.split("_")[1];
        const pedido = pedidos[pedidoId];

        if (!pedido) {
            return interaction.reply({ content: "Pedido não encontrado.", ephemeral: true });
        }

        pedido.status = "cancelado";

        const embedAtualizado = EmbedBuilder.from(interaction.message.embeds[0])
            .spliceFields(5, 1, { name: "Status", value: "🔴 Cancelado", inline: true });

        return interaction.update({ embeds: [embedAtualizado], components: [] });
    }
});

client.login(TOKEN);
 
