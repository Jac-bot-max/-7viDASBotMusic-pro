import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// SERVIDOR WEB LIGAÇÃO IMEDIATA
const app = express();
app.get('/', (req, res) => res.send('Motor Nitro Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // Limpa a pasta para não haver conflito de ligação
    if (fs.existsSync('./session_data')) fs.rmSync('./session_data', { recursive: true, force: true });

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // Disfarce padrão que conecta mais rápido
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // Configurações de velocidade
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    const numeroBot = "258865560063"; 

    if (!socket.authState.creds.registered) {
        // Espera apenas 5 segundos para o Render respirar e pede o código
        await delay(5000);
        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\nCÓDIGO: ${code}\n`);
        } catch (e) { console.log("Erro ao pedir código."); }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO EM 5 SEGUNDOS!");
        }
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text === ".key") {
            const creds = fs.readFileSync('./session_data/creds.json');
            await socket.sendMessage(from, { text: Buffer.from(creds).toString('base64') });
        }
        if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Online e Veloz!" });
    });
}
startBot();
