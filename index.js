import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR & IA (ESTABILIDADE)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema MZ & AO Online 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0');

// Configuração Gemini (IA)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "Tu és o @7viDASBotMusic, assistente de elite do JACKSON@7VIDAS para beatmakers de Moçambique e Angola. Responde de forma curta, profissional e motivadora. Usa gírias de produtor. Defenda sempre a união MZ & AO."
});

// Memória Global para Advertências
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
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 2: SISTEMA DE BOAS-VINDAS (WELCOME COM FOTO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n║ 🔴 Proibido Links/Status/Insultos!\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) { console.log("Erro Welcome:", e); }
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO!");
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
            // REGIÃO 3: XERIFE MÃO DE FERRO (ADMINISTRAÇÃO AUTOMÁTICA)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                // Detecção de Links, Status e Insultos
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
                const isInsulto = ["lixo", "fdp", "macaco", "bullying", "burro"].some(p => textLow.includes(p));

                if ((isLink || isStatus || isInsulto) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA

                    // Sistema de Advertência (Warn)
                    let v = (global.db.warns.get(sender) || 0) + 1;
                    global.db.warns.set(sender, v);

                    if (v >= 3 || isInsulto) {
                        await socket.groupParticipantsUpdate(from, [sender], "remove"); // BAN
                        const motive = isInsulto ? "Insultos" : "Spam de Links/Status";
                        await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} removido por ${motive}.`, mentions: [sender] });
                        global.db.warns.delete(sender);
                    } else {
                        await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}, respeite as regras! No próximo erro é BAN.`, mentions: [sender] });
                    }
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 4: CÉREBRO DE MÍDIA (ÁUDIO/VÍDEO)
            // =====================================================================
            if (type === 'audioMessage' || type === 'videoMessage') {
                if (msg.message?.audioMessage?.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // =====================================================================
            // REGIÃO 5: IA INTELIGENTE (AUTO-RESPONDER)
            // =====================================================================
            const keywords = ["oi", "ola", "olá", "como", "qual", "ajuda", "bot", "tudo bem", "kmk"];
            const isQuestion = textLow.includes("?");

            if (!textRaw.startsWith('.') && (keywords.some(k => textLow.includes(k)) || isQuestion || !isGroup)) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    await socket.sendMessage(from, { text: result.response.text() }, { quoted: msg });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 6: COMANDOS MANUAIS (PREFIXO . )
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const cmd = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            switch (cmd) {
                case "menu":
                    const menuTxt = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO MÃO DE FERRO*\n║ ◽ .infoadm | .infogrupo | .link\n║ ◽ .ban | .unwarn | .marcar\n║\n║ ⚪ *ESTÚDIO & IA*\n║ ◽ IA Gemini Ativa (Conversa Livre)\n║ ◽ .play | .yt | .drums | .vst\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping | .key\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝`;
                    await socket.sendMessage(from, { text: menuTxt });
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `👑 *JACKSON@7VIDAS*\n🎵 Cantor & Produtor\n💻 Programador\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
                    break;

                case "ping":
                    const start = Date.now();
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - start}ms\n🤖 *BOT:* @7viDASBotMusic Online` });
                    break;

                case "unwarn":
                    if (target) { global.db.warns.set(target, 0); await socket.sendMessage(from, { text: "✅ Advertências zeradas." }); }
                    break;

                case "ban":
                    if (target) await socket.groupParticipantsUpdate(from, [target], "remove");
                    break;

                case "marcar":
                    const g = await socket.groupMetadata(from);
                    await socket.sendMessage(from, { text: `📢 *AVISO:* ${query || 'Atenção membros!'}`, mentions: g.participants.map(p => p.id) });
                    break;

                case "yt": case "play": case "drums": case "vst":
                    await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                    const s = await yts(query || "jackson beatz");
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
