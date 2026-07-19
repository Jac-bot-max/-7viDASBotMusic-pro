import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR WEB ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0');

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
        browser: ['@7viDASBotMusic', 'Chrome', '1.0.0'],
        shouldSyncHistoryMessage: () => false // Otimiza a memória no Render
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });

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

            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                // ==========================================
                // 🛡️ REGIÃO: FILTRO DE ELITE (APAGAR TUDO)
                // ==========================================
                
                // 1. Detectar Compartilhamento de Status / Estado (O que está no seu print)
                const isStatus = type === 'protocolMessage' || 
                                 type === 'senderKeyDistributionMessage' || 
                                 msg.message?.statusMentionMessage || 
                                 textLow.includes("estado de") || 
                                 textLow.includes("status de");

                // 2. Detectar Links (http, www, .com, .net, chat.whatsapp)
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

                // 3. Detectar Mídia de Membros (Fotos/Vídeos que não são comandos)
                const isMidiaProibida = (type === 'imageMessage' || type === 'videoMessage') && !textRaw.startsWith('.');

                if ((isStatus || isLink || isMidiaProibida) && isBotAdmin && !isSenderAdmin) {
                    // REAÇÃO E APAGAR IMEDIATO
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await socket.sendMessage(from, { delete: msg.key }); // PROTOCOLO DE DELEÇÃO

                    // SISTEMA DE ADVERTÊNCIA
                    let v = (global.advertencias.get(sender) || 0) + 1;
                    global.advertencias.set(sender, v);

                    if (v >= 3) {
                        await socket.groupParticipantsUpdate(from, [sender], "remove");
                        await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} removido por Spam.`, mentions: [sender] });
                    } else {
                        await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}, não é permitido links ou status!`, mentions: [sender] });
                    }
                    return; // Para aqui, não processa comandos
                }
            }

            // ==========================================
            // 🎹 REGIÃO: CÉREBRO DE MÍDIA (BEATS)
            // ==========================================
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // ==========================================
            // 📝 REGIÃO: COMANDOS (PREFIXO .)
            // ==========================================
            if (!textRaw.startsWith('.')) {
                // Auto-Responder Social
                if (["oi", "olá", "kmk"].includes(textLow)) {
                    await socket.sendMessage(from, { text: `🔵 Olá! Como está a produção? 🇲🇿🇦🇴` }, { quoted: msg });
                }
                return;
            }

            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                await socket.sendMessage(from, { text: "╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *XERIFE AUTO*\n║ ◽ Anti-Status | Anti-Link\n║ ◽ Anti-Lixo | Auto-Ban\n║\n║ ⚪ *PRODUÇÃO*\n║ ◽ .yt | .foto | .play\n║ ◽ .drums | .vst | .apps\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════╝" });
            }

            if (command === "ping") await socket.sendMessage(from, { text: "🛰️ Jackson Beatz Online!" });

        } catch (e) { console.log("Erro:", e); }
    });
}
startBot();
