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

require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CANAL_VENDAS = process.env.CANAL_VENDAS;
const CANAL_LOGS = process.env.CANAL_LOGS;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

let pedidos = {};
let contador = 1;

const comandos = [
    new SlashCommandBuilder()
        .setName("painel")
        .setDescription("Enviar painel de vendas")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {

    await rest.put(
        Routes.applicationGuildCommands(
            CLIENT_ID,
            GUILD_ID
        ),
        {
            body: comandos
        }
    );

    console.log("✅ Slash Commands registrados");

})();

client.once("ready", () => {

    console.log(`🤖 ${client.user.tag} online`);

});

client.on("interactionCreate", async interaction => {

    // ===========================
    // COMANDO /PAINEL
    // ===========================

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "painel") {

            const embed = new EmbedBuilder()

                .setColor("#1e1f22")

                .setTitle("💣 MARROKAN STORE")

                .setDescription(`
Bem-vindo ao sistema de vendas.

Clique no botão abaixo para realizar um pedido.

━━━━━━━━━━━━━━━━━━━━━━

🟢 Atendimento Automático

📦 Estoque Atualizado

💰 Melhor preço da cidade

━━━━━━━━━━━━━━━━━━━━━━
`);

            const row = new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId("novo_pedido")

                        .setLabel("🛒 Fazer Pedido")

                        .setStyle(ButtonStyle.Success)

                );

            return interaction.reply({

                embeds: [embed],

                components: [row]

            });

        }

    }

    // ===========================
    // BOTÃO
    // ===========================

    if (interaction.isButton()) {

        if (interaction.customId === "novo_pedido") {

            const modal = new ModalBuilder()

                .setCustomId("dados_cliente")

                .setTitle("Novo Pedido");

            const nome = new TextInputBuilder()

                .setCustomId("nome")

                .setLabel("Nome RP")

                .setStyle(TextInputStyle.Short);

            const telefone = new TextInputBuilder()

                .setCustomId("telefone")

                .setLabel("Telefone In-Game")

                .setStyle(TextInputStyle.Short);

            modal.addComponents(

                new ActionRowBuilder().addComponents(nome),

                new ActionRowBuilder().addComponents(telefone)

            );

            return interaction.showModal(modal);

        }

    }

    // ===========================
    // MODAL
    // ===========================

    if (interaction.isModalSubmit()) {

        if (interaction.customId === "dados_cliente") {

            const nome = interaction.fields.getTextInputValue("nome");

            const telefone = interaction.fields.getTextInputValue("telefone");

            pedidos[interaction.user.id] = {

                nome,

                telefone

            };

            const menu = new ActionRowBuilder()

                .addComponents(

                    new StringSelectMenuBuilder()

                        .setCustomId("produto")

                        .setPlaceholder("Escolha o produto")

                        .addOptions(

                            {

                                label: "🔫 Pistola",

                                value: "Pistola"

                            },

                            {

                                label: "🔫 Sub",

                                value: "Sub"

                            },

                            {

                                label: "🎯 Rifle",

                                value: "Rifle"

                            },

                            {

                                label: "💥 Escopeta",

                                value: "Escopeta"

                            }

                        )

                );

            return interaction.reply({

                content: "Escolha o produto",

                components: [menu],

                ephemeral: true

            });

        }

    }

});
// ===========================
// MENU PRODUTO
// ===========================

if (interaction.isStringSelectMenu()) {

    // PRODUTO
    if (interaction.customId === "produto") {

        pedidos[interaction.user.id].produto = interaction.values[0];

        const row = new ActionRowBuilder()
            .addComponents(

                new StringSelectMenuBuilder()

                    .setCustomId("quantidade")

                    .setPlaceholder("Escolha a quantidade")

                    .addOptions(

                        { label: "50", value: "50" },
                        { label: "100", value: "100" },
                        { label: "250", value: "250" },
                        { label: "500", value: "500" },
                        { label: "1000", value: "1000" }

                    )

            );

        return interaction.update({

            content: "📦 Escolha a quantidade",

            components: [row]

        });

    }

    // QUANTIDADE
    if (interaction.customId === "quantidade") {

        pedidos[interaction.user.id].quantidade = Number(interaction.values[0]);

        const row = new ActionRowBuilder()

            .addComponents(

                new StringSelectMenuBuilder()

                    .setCustomId("categoria")

                    .setPlaceholder("Categoria")

                    .addOptions(

                        {

                            label: "🤝 Parceiro",

                            value: "Parceiro"

                        },

                        {

                            label: "🚔 Pista",

                            value: "Pista"

                        }

                    )

            );

        return interaction.update({

            content: "💰 Escolha a categoria",

            components: [row]

        });

    }

    // CATEGORIA
    if (interaction.customId === "categoria") {

        pedidos[interaction.user.id].categoria = interaction.values[0];

        const dados = pedidos[interaction.user.id];

        let preco = 0;

        // TABELA DE PREÇOS
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

        preco = tabela[dados.categoria][dados.produto] * dados.quantidade;

        const numeroPedido = String(contador).padStart(6, "0");

        contador++;

        dados.numero = numeroPedido;

        dados.valor = preco;

        dados.clienteDiscord = interaction.user.id;

        dados.status = "🟡 Aguardando vendedor";

        const embed = new EmbedBuilder()

            .setColor("#1f1f1f")

            .setTitle(`📦 Pedido #${numeroPedido}`)

            .addFields(

                {

                    name: "👤 Cliente",

                    value: dados.nome,

                    inline: true

                },

                {

                    name: "📱 Telefone",

                    value: dados.telefone,

                    inline: true

                },

                {

                    name: "🔫 Produto",

                    value: dados.produto,

                    inline: true

                },

                {

                    name: "📦 Quantidade",

                    value: dados.quantidade.toString(),

                    inline: true

                },

                {

                    name: "💰 Categoria",

                    value: dados.categoria,

                    inline: true

                },

                {

                    name: "💵 Valor",

                    value: `R$ ${preco.toLocaleString("pt-BR")}`,

                    inline: true

                },

                {

                    name: "👮 Responsável",

                    value: "Aguardando..."

                },

                {

                    name: "📌 Status",

                    value: dados.status

                }

            )

            .setTimestamp();

        const botoes = new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()

                    .setCustomId(`assumir_${numeroPedido}`)

                    .setLabel("👤 Assumir")

                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()

                    .setCustomId(`entregar_${numeroPedido}`)

                    .setLabel("✅ Entregar")

                    .setStyle(ButtonStyle.Success)

                    .setDisabled(true),

                new ButtonBuilder()

                    .setCustomId(`cancelar_${numeroPedido}`)

                    .setLabel("❌ Cancelar")

                    .setStyle(ButtonStyle.Danger)

                    .setDisabled(true)

            );

        const canal = await client.channels.fetch(CANAL_VENDAS);

        const mensagem = await canal.send({

            embeds: [embed],

            components: [botoes]

        });

        dados.mensagem = mensagem.id;

        pedidos[numeroPedido] = dados;

        delete pedidos[interaction.user.id];

        return interaction.update({

            content: "✅ Pedido enviado com sucesso!",

            components: []

        });

    }

}
