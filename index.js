import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB IMEDIATO
const app = express();
app.get('/', (req, res) => res.send('Sistema de Resgate Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    console.log("🔄 Limpando cache para nova tentativa...");
    
    // Apaga a pasta de sessão para garantir um código NOVO e LIMPO
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        // Disfarce de navegador moderno para evitar o erro de associação
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false
    });

    // --- SOLICITAÇÃO DO CÓDIGO ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 A preparar pedido para: ${numeroBot}`);
        
        // Esperamos 20 segundos para o Render estabilizar a rede 100%
        await delay(20000); 

        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`TEU NOVO CÓDIGO: ${code}`);
            console.log("=======================================\n");
        } catch (err) {
            console.log("❌ Erro no pedido. Aguarde 1 hora antes de tentar de novo.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ CONECTADO! MANDA .key NO WHATSAPP!");
        }
        if (connection === "close") {
            console.log("⚠️ Conexão fechada. A reiniciar...");
            startBot();
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation?.toLowerCase() === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                await socket.sendMessage(msg.key.remoteJid, { text: `🔐 *KEY:* \n\n${Buffer.from(creds).toString('base64')}` });
            } catch (e) { console.log(e); }
        }
    });
}

startBot();
