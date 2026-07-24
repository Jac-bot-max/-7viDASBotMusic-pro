import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID || process.env.SESSION_DATA;
    
    // Procura o número em qualquer um dos dois nomes possíveis
    const numeroBot = process.env.NUMERO_BOT || process.env.NUMERO_DO_BOT;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decodedSession = Buffer.from(sessionID, 'base64').toString('utf-8');
            if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
            fs.writeFileSync('./session_data/creds.json', decodedSession);
            console.log("📂 Sessão restaurada com sucesso!");
        } catch (e) { console.log("❌ Erro ao decodificar SESSION_ID"); }
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DE PAREAMENTO REFORÇADA ---
    if (!socket.authState.creds.registered) {
        if (numeroBot) {
            const cleanNumber = numeroBot.replace(/[^0-9]/g, '');
            console.log(`📡 Solicitando código para: ${cleanNumber}`);
            setTimeout(async () => {
                try {
                    let code = await socket.requestPairingCode(cleanNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log("\n=======================================");
                    console.log(`DIGITE ESTE CÓDIGO NO WHATSAPP: ${code}`);
                    console.log("=======================================\n");
                } catch (err) { console.log("❌ Erro ao gerar código de pareamento."); }
            }, 5000);
        } else {
            console.log("⚠️ AVISO: Variável de número não encontrada. Verifique o Render.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") {
            console.log("✅ @7viDASBotMusic: CONECTADO COM SUCESSO!");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
            
            if (textRaw.toLowerCase() === ".ping") {
                await socket.sendMessage(from, { text: "🛰️ Estou online de novo! 🇲🇿🇦🇴" });
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
