import express from 'express';
import makeWASocket, { useMultiFileAuthState, delay, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Motor de Resgate JACKSON@7VIDAS'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // LIMPEZA TOTAL: Começar do zero para o código funcionar
    if (fs.existsSync('./session_data')) fs.rmSync('./session_data', { recursive: true, force: true });

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'fatal' }), // Silêncio total para economizar RAM
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // --- BLOQUEIO TOTAL DE DADOS (O SEGREDO) ---
        shouldSyncHistoryMessage: () => false, 
        syncFullHistory: false,
        markOnlineOnConnect: false, // Não mostra online para ser mais rápido
        connectTimeoutMs: 60000,
        generateHighQualityLinkPreview: false
    });

    const numeroBot = process.env.NUMERO_BOT; 

    if (!socket.authState.creds.registered && numeroBot) {
        console.log(`📡 Preparando sinal para: ${numeroBot}`);
        await delay(15000); // Espera o Render respirar
        try {
            let code = await socket.requestPairingCode(numeroBot);
            console.log(`\n=======================================\nCÓDIGO NOVO: ${code}\n=======================================\n`);
        } catch (err) { console.log("Erro no pedido. Tente Manual Deploy."); }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO! ESCREVE .key NO WHATSAPP AGORA!");
        }
        if (u.connection === "close") startBot();
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
