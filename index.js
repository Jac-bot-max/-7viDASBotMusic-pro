import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR WEB (ESTABILIDADE RENDER)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema Dot Logic Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 2: BOAS-VINDAS POR CARGO (.)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 *CARGO:* Membro Produtor\n║ 🔵 Digite *.menu* para começar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO COM PREFIXO .");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // REGIÃO 3: CÉREBRO DE MÍDIA & SOCIAL
            // =====================================================================
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // AUTO-RESPONDER SOCIAL (Oi, Ola, Kmk)
            const saudações = ["oi", "olá", "ola", "kmk família", "kmk beatmakers", "bom dia", "boa tarde", "boa noite"];
            if (saudações.includes(textLow)) {
                await socket.sendMessage(from, { text: `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Como está a produção por aí? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (!isGroup) {
                // Comandos manuais no privado também usam o ponto (.)
            } else {
                // =====================================================================
                // REGIÃO 4: XERIFE MÃO DE FERRO (ADMINISTRAÇÃO AUTO)
                // =====================================================================
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

                if ((isStatus || isLink) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Links ou Status são proibidos. Mantenha o grupo limpo! 🇲🇿🇦🇴` });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 5: COMANDOS MANUAIS (PREFIXO . )
            // =====================================================================
            if (!textRaw.startsWith('.')) return; // NOVO PREFIXO: PONTO (.)
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            const pesquisar = async (t) => {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                return await yts(t);
            };

            switch (command) {
                case "menu":
                    await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .infoadm | .infogrupo | .link\n║ ◽ .ban | .marcar | .promover\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ .play [musica] (YouTube)\n║ ◽ .foto [nome] | .drums [estilo]\n║ ◽ .vst [nome] | .apps | .dicas\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping - Velocidade do Bot\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝` });
                    break;

                case "play": // O COMANDO QUE VOCÊ PEDIU
                    if (!query) return socket.sendMessage(from, { text: "🔍 _Diga o nome da música ou artista! Ex: .play Twenty Finger_" });
                    const s = await pesquisar(query);
                    if (s.videos[0]) {
                        const v = s.videos[0];
                        await socket.sendMessage(from, { 
                            text: `🎧 *REPRODUZINDO @7viDASBotMusic*\n\n📌 *Título:* ${v.title}\n👤 *Canal:* ${v.author.name}\n🔗 *Link:* ${v.url}\n\n_Jackson@7Vidas trazendo o melhor da música!_` 
                        });
                    }
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 🎵 Cantor & Produtor\n║ 💳 Agente Vodacom & Movitel\n║ 💻 Programador & Estudante\n║ 📞 +258 87 733 8300\n╚══════ 🇲🇿 MZ & AO 🇦🇴 ══════╝` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* Estável\n🤖 *BOT:* Ativo e vigilante!` });
                    break;
                
                case "link":
                    const groupMetadata = await socket.groupMetadata(from);
                    const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                    const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                    if (isBotAdmin) {
                        const code = await socket.groupInviteCode(from);
                        await socket.sendMessage(from, { text: `🔗 *LINK:* https://chat.whatsapp.com/${code}` });
                    }
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
