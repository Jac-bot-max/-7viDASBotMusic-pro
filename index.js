import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR WEB & IA (ESTABILIDADE)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Online e Vigilante 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

if (!global.db) global.db = { warns: new Map() };

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
        browser: ['@7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 2: BOAS-VINDAS PROFISSIONAL (WELCOME COM FOTO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        if (action === 'add') {
            for (const num of participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(num, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcomeTxt = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá, @${num.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para ver comandos.\n║ 🔴 Proibido Links/Status/Insultos!\n╚══════════════════════════════╝`;
                    await socket.sendMessage(id, { image: { url: pp }, caption: welcomeTxt, mentions: [num] });
                } catch (e) { console.log("Erro Welcome:", e); }
            }
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // REGIÃO 3: XERIFE MÃO DE FERRO (ANTI-STATUS & ANTI-LINK)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                // Detecção de Status e Links
                const isStatusShare = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("@ este grupo foi mencionado");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

                if ((isStatusShare || isLink) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key });
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA ATIVA:* @${sender.split('@')[0]}, remover status/links é automático para manter o grupo limpo.`, mentions: [sender] });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 4: CÉREBRO DE MÍDIA (BEATS & INSTRUMENTAIS)
            // =====================================================================
            if (type === 'audioMessage') {
                if (msg.message?.audioMessage?.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // =====================================================================
            // REGIÃO 5: COMANDOS MANUAIS ESPECÍFICOS (.)
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const cmd = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            switch (cmd) {
                case "menu":
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .marcar - Promover o grupo\n║ ◽ .link | .ban | .warn\n║\n║ ⚪ *PRODUÇÃO*\n║ ◽ .play | .yt | .drums | .vst\n║ ◽ .apps | .dicas | .foto\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping | .infoadm\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "marcar": // O COMANDO QUE TE DAVA PREGUIÇA
                    if (!isGroup) return;
                    const group = await socket.groupMetadata(from);
                    const members = group.participants.map(p => p.id);
                    const promoText = `📢 *ATENÇÃO MEMBROS!*\n\n🚀 Vamos promover o grupo para que tenhamos mais produtores! Atualmente o nosso número de membros é pequeno, vamos crescer juntos! 🇲🇿🇦🇴\n\n🔗 *PARTILHEM O LINK:* https://chat.whatsapp.com/${await socket.groupInviteCode(from)}`;
                    await socket.sendMessage(from, { text: promoText, mentions: members });
                    break;

                case "link":
                    const code = await socket.groupInviteCode(from);
                    await socket.sendMessage(from, { text: `🔗 *LINK OFICIAL DO GRUPO:* \nhttps://chat.whatsapp.com/${code}` });
                    break;

                case "play": case "yt": case "drums": case "vst": case "apps":
                    await socket.sendMessage(from, { text: `🔍 *PESQUISANDO:* _"${query || 'Geral'}"_... Aguarde.` });
                    const s = await yts(query + (cmd === "apps" ? " apk download" : " production music"));
                    if (s.videos[0]) {
                        await socket.sendMessage(from, { text: `📺 *RESULTADO*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    }
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 🎵 Cantor & Produtor\n║ 💻 Programador & Agente\n║ 📞 +258 87 733 8300\n╚══════ 🇲🇿 MZ & AO 🇦🇴 ══════╝` });
                    break;
            }

        } catch (e) { console.log(e); }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });
}
startBot();
