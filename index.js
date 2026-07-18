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
app.get('/', (req, res) => res.send('Bot Moçambicano Online! 🇲🇿'));
app.listen(process.env.PORT || 10000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    // RECUPERAR SESSÃO VIA SESSION_ID (A chave que você já tem)
    const sessionID = process.env.SESSION_ID;
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Ainda mostra no log caso precise
        browser: ['Bot MZ', 'Safari', '3.0']
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ BOT MOÇAMBICANO CONECTADO!");
        }
    });

    // COMANDO SIMPLES DE TESTE
    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text.toLowerCase() === "!ping") {
            await socket.sendMessage(msg.key.remoteJid, { text: "🇲🇿 Pong! Bot Moçambicano ativo no Render!" });
        }
    });
}

startBot();
