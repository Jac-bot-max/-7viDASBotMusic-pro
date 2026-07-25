import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB IMEDIATO
const app = express();
app.get('/', (req, res) => res.send('Motor de Conexão Relâmpago Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // RESET TOTAL: Limpa tudo para não carregar lixo da tentativa anterior
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), // Log mínimo para economizar RAM
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // --- BLOQUEIO TOTAL DE SINCRONIZAÇÃO (PARA NÃO TRAVAR) ---
        shouldSyncHistoryMessage: () => false, 
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        getMessage: async (key) => { return { conversation: '7viDASBot' } }
    });

    // --- SOLICITAÇÃO DO CÓDIGO ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 A solicitar código para o bot: ${numeroBot}`);
        await delay(15000); // Espera 15s para estabilizar

        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`TEU CÓDIGO É: ${code}`);
            console.log("=======================================\n");
        } catch (err) {
            console.log("❌ Erro. Aguarde o Render reiniciar.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ CONECTADO INSTANTANEAMENTE!");
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            // Só reconecta se não for erro de login
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                await socket.sendMessage(msg.key.remoteJid, { text: `🔐 *KEY:* \n\n${Buffer.from(creds).toString('base64')}` });
            } catch (e) { console.log(e); }
        }
    });
}

startBot();
