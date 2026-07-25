import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. LIGAÇÃO IMEDIATA DO SERVIDOR (FUNDAMENTAL PARA O RENDER)
const app = express();
app.get('/', (req, res) => res.send('A forçar notificação para o Jackson... 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("✅ Servidor Web Online"));

async function startBot() {
    // RESET ABSOLUTO: Limpa qualquer rastro que esteja a bloquear o código novo
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
        console.log("🧹 Memória limpa!");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        // DISFARCE DE IPAD (O WhatsApp confia muito neste para mandar código)
        browser: ["Mac OS", "Safari", "15.0"], 
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false
    });

    // --- LÓGICA DE NOTIFICAÇÃO DE ALTA FORÇA ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 A preparar sinal de alta frequência para o 84...`);
        
        // Esperamos 30 segundos (Tempo vital para o WhatsApp não bloquear o Render)
        await delay(30000); 

        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`TEU CÓDIGO É: ${code}`);
            console.log("=======================================\n");
            console.log("👉 Se não vibrar, clica em 'Vincular com número' no teu WhatsApp AGORA!");
        } catch (err) {
            console.log("❌ O WhatsApp bloqueou o pedido. Tenta amanhã de manhã.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("✅ CONECTADO! MANDA .key NO WHATSAPP!");
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                await socket.sendMessage(msg.key.remoteJid, { text: `🔐 *KEY NOVA:* \n\n${Buffer.from(creds).toString('base64')}` });
            } catch (e) { console.log(e); }
        }
    });
}

startBot();
