const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');

// SERVIDOR PARA O RENDER
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Bot Moçambicano Online! 🇲🇿'));
app.listen(port, '0.0.0.0', () => console.log(`Porta ${port} ativa`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    // USANDO AS VARIÁVEIS EXATAS DO SEU PRINT
    const sessionData = process.env.SESSION_DATA;
    const numeroBot = process.env.NUMERO_DO_BOT;

    if (sessionData && !fs.existsSync('./session_data/creds.json')) {
        console.log("Recuperando sessão via SESSION_DATA...");
        const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Bot MZ', 'Safari', '3.0']
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ BOT MOÇAMBICANO CONECTADO COM SUCESSO!");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text.toLowerCase() === "!ping") {
            await socket.sendMessage(msg.key.remoteJid, { text: "🇲🇿 Pong! Bot ativo e reconhecendo as suas variáveis!" });
        }
    });
}

startBot();
