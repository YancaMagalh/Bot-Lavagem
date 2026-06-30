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
// Estrutura: tabelas[produto][categoria][item] = preço
const tabelas = {
    Armas: {
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
    },
    "Munição (Pack 50)": {
        Parceiro: {
            "M. de Pistola": 8000,
            "M. de Sub": 10000,
            "M. de Rifle": 12000,
            "M. de Escopeta": 14000
        },
        Pista: {
            "M. de Pistola": 10000,
            "M. de Sub": 12000,
            "M. de Rifle": 14000,
            "M. de Escopeta": 16000
        }
    }
};

// Apelidos curtos pra usar no customId (não pode ter espaços/acentos problemáticos)
const produtoKeys = {
    Armas: "Armas",
    "Munição (Pack 50)": "Municao"
};
const produtoPorKey = Object.fromEntries(
    Object.entries(produtoKeys).map(([nome, key]) => [key, nome])
);

function formatarReal(valor) {
    return `R$ ${valor.toLocaleString("pt-BR")}`;
}

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

    // ===== Botão: iniciar pedido -> escolher produto =====
    if (interaction.isButton() && interaction.customId === "novoPedido") {
        const menu = new StringSelectMenuBuilder()
            .setCustomId("escolherProduto")
            .setPlaceholder("Selecione o produto")
            .addOptions(
                Object.keys(tabelas).map(produto => ({
                    label: produto,
                    value: produtoKeys[produto]
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
            content: "O que você deseja comprar?",
            components: [row],
            ephemeral: true
        });
    }

    // ===== Select: produto -> escolher categoria =====
    if (interaction.isStringSelectMenu() && interaction.customId === "escolherProduto") {
        const produtoKey = interaction.values[0];
        const produtoNome = produtoPorKey[produtoKey];
        const categorias = tabelas[produtoNome];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`escolherCategoria_${produtoKey}`)
            .setPlaceholder("Selecione a categoria")
            .addOptions(
                Object.keys(categorias).map(categoria => ({
                    label: categoria,
                    value: categoria
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.update({
            content: `Produto: **${produtoNome}**\nAgora escolha a categoria:`,
            components: [row]
        });
    }

    // ===== Select: categoria -> escolher item =====
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("escolherCategoria_")) {
        const produtoKey = interaction.customId.split("_")[1];
        const produtoNome = produtoPorKey[produtoKey];
        const categoria = interaction.values[0];
        const itens = tabelas[produtoNome][categoria];

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`escolherItem_${produtoKey}_${categoria}`)
            .setPlaceholder("Selecione o item")
            .addOptions(
                Object.entries(itens).map(([nome, preco]) => ({
                    label: `${nome} - ${formatarReal(preco)}`,
                    value: nome
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.update({
            content: `Produto: **${produtoNome}**\nCategoria: **${categoria}**\nAgora escolha o item:`,
            components: [row]
        });
    }

    // ===== Select: item -> abrir modal de quantidade =====
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("escolherItem_")) {
        const partes = interaction.customId.split("_");
        const produtoKey = partes[1];
        const categoria = partes[2];
        const item = interaction.values[0];
        const produtoNome = produtoPorKey[produtoKey];

        const ehMunicao = produtoKey === "Municao";

        const modal = new ModalBuilder()
            .setCustomId(`modalQuantidade_${produtoKey}_${categoria}_${item}`)
            .setTitle(`Pedido - ${item}`);

        const inputQuantidade = new TextInputBuilder()
            .setCustomId("quantidade")
            .setLabel(ehMunicao ? "Quantidade de packs (50un cada)" : "Quantidade")
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
        const partes = interaction.customId.split("_");
        const produtoKey = partes[1];
        const categoria = partes[2];
        const item = partes.slice(3).join("_");
        const produtoNome = produtoPorKey[produtoKey];

        const quantidadeRaw = interaction.fields.getTextInputValue("quantidade");
        const quantidade = parseInt(quantidadeRaw, 10);

        if (isNaN(quantidade) || quantidade <= 0) {
            return interaction.reply({
                content: "❌ Quantidade inválida. Use apenas números maiores que 0.",
                ephemeral: true
            });
        }

        const precoUnitario = tabelas[produtoNome][categoria][item];
        const total = precoUnitario * quantidade;
        const pedidoId = contador++;

        pedidos[pedidoId] = {
            id: pedidoId,
            cliente: interaction.user.id,
            produto: produtoNome,
            categoria,
            item,
            quantidade,
            total,
            status: "pendente"
        };

        const embed = new EmbedBuilder()
            .setColor("#2B2D31")
            .setTitle(`🧾 Pedido #${pedidoId}`)
            .addFields(
                { name: "Cliente", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Produto", value: produtoNome, inline: true },
                { name: "Categoria", value: categoria, inline: true },
                { name: "Item", value: item, inline: true },
                { name: "Quantidade", value: `${quantidade}`, inline: true },
                { name: "Total", value: formatarReal(total), inline: true },
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
            content: `✅ Pedido criado com sucesso! Total: **${formatarReal(total)}**`,
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
            .spliceFields(6, 1, { name: "Status", value: `🟢 Entregue por <@${vendedorId}>`, inline: true });

        await interaction.update({ embeds: [embedAtualizado], components: [] });

        const canalLogs = await client.channels.fetch(CANAL_LOGS_ID).catch(() => null);
        if (canalLogs) {
            canalLogs.send(
                `📦 Pedido #${pedidoId} entregue por <@${vendedorId}> — Total: ${formatarReal(pedido.total)}`
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
            .spliceFields(6, 1, { name: "Status", value: "🔴 Cancelado", inline: true });

        return interaction.update({ embeds: [embedAtualizado], components: [] });
    }
});

client.login(TOKEN);
