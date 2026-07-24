import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: ESTABILIDADE RENDER (PORTA 10000)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    // =========================================================================
    // REGIÃO 2: CÉREBRO DE CONEXÃO (SESSÃO E PAREAMENTO)
    // =========================================================================
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;
    const numeroBot = process.env.NUMERO_BOT; // Pega o número das variáveis do Render

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
            if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data', { recursive: true });
            fs.writeFileSync('./session_data/creds.json', decoded);
            console.log("📂 Sessão restaurada via SESSION_ID");
        } catch (e) { console.log("❌ Erro na SESSION_ID"); }
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DE PAREAMENTO POR CÓDIGO ---
    if (!socket.authState.creds.registered) {
        if (numeroBot) {
            console.log(`📡 Solicitando código para: ${numeroBot}`);
            setTimeout(async () => {
                try {
                    let code = await socket.requestPairingCode(numeroBot);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log("\n=======================================");
                    console.log(`DIGITE ESTE CÓDIGO NO WHATSAPP: ${code}`);
                    console.log("=======================================\n");
                } catch (err) { console.log("❌ Erro ao gerar código:", err); }
            }, 5000);
        } else {
            console.log("⚠️ AVISO: Configura a variável NUMERO_BOT no Render para gerar o código.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log("✅ @7viDASBotMusic: CONECTADO COM SUCESSO!");
        }
    });

    // =========================================================================
    // REGIÃO 3: MÃO DE FERRO E CÉREBRO DE MÍDIA
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

            // 3.1. DIFERENÇAR VOZ VS BEAT/VÍDEO
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            if (type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Vídeo recebido. Positivo, aguarde a análise dos beatmakers._" }, { quoted: msg });
                return;
            }

            // 3.2. XERIFE (STATUS E LINKS)
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
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA
                    return;
                }
            }

            // =========================================================================
            // REGIÃO 4: COMANDOS MANUAIS (.)
            // =========================================================================
            if (!textRaw.startsWith('.')) {
                // Auto-responder Oi/Kmk
                if (["oi", "olá", "kmk"].includes(textLow)) {
                    await socket.sendMessage(from, { text: `🔵 Olá! Como está a produção hoje? 🇲🇿🇦🇴` }, { quoted: msg });
                }
                return;
            }

            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                await socket.sendMessage(from, { text: "╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .link | .ban | .marcar\n║\n║ ⚪ *PRODUÇÃO*\n║ ◽ .yt | .play | .drums\n║ ◽ .foto | .infoadm\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════╝" });
            }

            if (command === "ping") await socket.sendMessage(from, { text: "🛰️ Jackson Beatz Online!" });

            if (command === "yt" || command === "play") {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                const s = await yts(query || "jackson beatz");
                if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
