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
app.get('/', (req, res) => res.send('@7viDASBotMusic IA + Xerife Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0');

// Configuração Gemini (IA)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "Tu és o @7viDASBotMusic, assistente de elite do JACKSON@7VIDAS para beatmakers de Moçambique e Angola. Responde com educação, gírias de produção musical e defenda sempre a união MZ & AO."
});

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
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 2: XERIFE MÃO DE FERRO (SEGURANÇA TOTAL) - PRIORIDADE MÁXIMA
    // =========================================================================
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

                // --- DETECÇÃO DE LIXO (Links, Status, Imagens aleatórias) ---
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
                const isInsulto = ["lixo", "fdp", "bullying", "macaco", "preto"].some(p => textLow.includes(p));
                // Apaga mídia de membros se não for comando de foto ou áudio
                const isMidiaIrrelevante = (type === 'imageMessage' || type === 'videoMessage') && !textRaw.startsWith('.');

                if ((isLink || isStatus || isInsulto || isMidiaIrrelevante) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA

                    let v = (global.advertencias.get(sender) || 0) + 1;
                    global.advertencias.set(sender, v);

                    if (v >= 3 || isInsulto) {
                        await socket.groupParticipantsUpdate(from, [sender], "remove"); // BAN
                        await socket.sendMessage(from, { text: `🔴 *EXPULSO:* @${sender.split('@')[0]} violou as regras do grupo. Mantenha o ambiente limpo!`, mentions: [sender] });
                    } else {
                        await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}, conteúdo proibido detectado!`, mentions: [sender] });
                    }
                    return; // ENCERRA AQUI, A IA NÃO RESPONDE LIXO
                }
            }

            // =====================================================================
            // REGIÃO 3: CÉREBRO DE MÍDIA (ÁUDIO/VÍDEO)
            // =====================================================================
            if (type === 'audioMessage' || (type === 'videoMessage' && textLow.includes("beat"))) {
                if (msg.message?.audioMessage?.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // =====================================================================
            // REGIÃO 4: IA GEMINI (CONVERSA INTELIGENTE)
            // =====================================================================
            const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';
            const isMentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botId);

            if (!textRaw.startsWith('.') && (isMentioned || !isGroup)) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    const response = result.response.text();
                    await socket.sendMessage(from, { text: `🤖 *ASSISTENTE JACKSON@7VIDAS*\n\n${response}` }, { quoted: msg });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 5: COMANDOS MANUAIS (PREFIXO . )
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const cmd = args.shift().toLowerCase();
            const query = args.join(" ");

            if (cmd === "menu") {
                const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *XERIFE AUTOMÁTICO*
║ ◽ Anti-Status | Anti-Link
║ ◽ Anti-Lixo | Auto-Ban
║
║ ⚪ *INTELIGÊNCIA ARTIFICIAL*
║ ◽ Mencione o bot para conversar
║ ◽ Peça dicas de produção musical
║
║ 🔵 *BUSCAS PRO*
║ ◽ .yt | .foto | .play | .drums
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            if (cmd === "ping") {
                const lat = Date.now() - (msg.messageTimestamp * 1000);
                await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${lat}ms\n🤖 *IA:* Gemini 1.5 Ativa` });
            }

            if (cmd === "yt" || cmd === "play" || cmd === "drums") {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                const s = await yts(query || "jackson beatz");
                if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

        } catch (e) { console.log(e); }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });
}
startBot();
