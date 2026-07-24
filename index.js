import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Aguardando Conexão...'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;
    const numeroBot = "258848786486"; // Confirme se este é o número do bot

    // Tenta restaurar se a chave existir
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
            if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
            fs.writeFileSync('./session_data/creds.json', decoded);
        } catch (e) { console.log("Erro ao ler SESSION_ID"); }
    }

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Chrome', '1.0.0']
    });

    // --- SE A CHAVE FALHAR, GERA CÓDIGO DE 8 DÍGITOS ---
    if (!socket.authState.creds.registered) {
        setTimeout(async () => {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`SEU NOVO CÓDIGO: ${code}`);
            console.log("=======================================\n");
        }, 5000);
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            const status = lastDisconnect?.error?.output?.statusCode;
            if (status !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log("✅ @7viDASBotMusic: CONECTADO COM SUCESSO!");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();
        if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Estou online de novo!" });
    });
}
startBot();
