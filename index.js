import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, jidDecode } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// ==========================================
// 🔵 REGIÃO 1: SISTEMA CORE (ESTABILIDADE)
// ==========================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - MZ & AO Online'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
if (!global.warns) global.warns = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', Buffer.from(sessionID, 'base64').toString('utf-8'));
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Chrome', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // ==========================================
    // 🟠 REGIÃO 2: BOAS-VINDAS (PERSONALIZADO)
    // ==========================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const txt = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: txt, mentions: [jid] });
                } catch (e) {}
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
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // ==========================================
            // 🛡️ REGIÃO 3: XERIFE MÃO DE FERRO (AUTO-MOD)
            // ==========================================
            if (isGroup) {
                const meta = await socket.groupMetadata(from);
                const admins = meta.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("@ este grupo foi mencionado");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

                if ((isStatus || isLink) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* @${sender.split('@')[0]}, remover status/links é automático aqui. Mantenha o grupo limpo! 🇲🇿🇦🇴`, mentions: [sender] });
                    return;
                }
            }

            // ==========================================
            // 🧠 REGIÃO 4: CÉREBRO DE MÍDIA (VOZ VS BEAT)
            // ==========================================
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // ==========================================
            // 😊 REGIÃO 5: RESPOSTAS SOCIAIS (IA GEMINI)
            // ==========================================
            const greets = ["oi", "olá", "ola", "kmk", "bom dia", "boa tarde", "boa noite", "tudo bem"];
            const isMention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');

            if (!textRaw.startsWith('.') && (greets.includes(textLow) || isMention || !isGroup)) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    await socket.sendMessage(from, { text: result.response.text() }, { quoted: msg });
                    return;
                }
            }

            // ==========================================
            // 📝 REGIÃO 6: COMANDOS MANUAIS (ESPECÍFICOS)
            // ==========================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const cmd = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            const wait = async () => await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });

            switch (cmd) {
                case "menu":
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .marcar | .link | .ban\n║ ◽ .infoadm | .infogrupo\n║\n║ ⚪ *PRODUÇÃO*\n║ ◽ .play | .yt | .drums | .vst\n║ ◽ .apps | .dicas | .foto\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping | .key\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "marcar":
                    const g = await socket.groupMetadata(from);
                    const promo = `📢 *ATENÇÃO MEMBROS!*\n\n🚀 Vamos promover o grupo para que tenhamos mais produtores! Atualmente o nosso número de membros é pequeno, vamos crescer juntos! 🇲🇿🇦🇴\n\n🔗 *LINK:* https://chat.whatsapp.com/${await socket.groupInviteCode(from)}`;
                    await socket.sendMessage(from, { text: promo, mentions: g.participants.map(p => p.id) });
                    break;

                case "play": case "yt": case "drums": case "vst": case "apps": case "dicas":
                    await wait();
                    const s = await yts(query + (cmd === "apps" ? " download" : " production"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "ban":
                    const meta = await socket.groupMetadata(from);
                    const isBotAdmin = meta.participants.find(p => p.id === socket.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
                    const isSenderAdmin = meta.participants.find(p => p.id === sender)?.admin;
                    if (isBotAdmin && isSenderAdmin && target) await socket.groupParticipantsUpdate(from, [target], "remove");
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - (msg.messageTimestamp * 1000)}ms` });
                    break;
                
                case "infoadm":
                    await socket.sendMessage(from, { text: `👑 *JACKSON@7VIDAS*\n🎵 Cantor & Produtor\n💻 Programador\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
                    break;
            }
        } catch (e) { console.log(e); }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });
}
startBot();
