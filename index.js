import express from 'express';
import makeWASocket, { useMultiFileAuthState, delay, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB (LIGAR IMEDIATO PARA O RENDER NÃO MATAR O BOT)
const app = express();
app.get('/', (req, res) => res.send('Motor de Resgate Online 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("✅ Servidor Web OK"));

async function startBot() {
    // RESET TOTAL: Apaga pastas antigas para garantir código novo
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        // --- BLOQUEIO TOTAL DE HISTÓRICO PARA NÃO TRAVAR ---
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false
    });

    // --- LÓGICA DE NOTIFICAÇÃO COM ESPERA DE 40 SEGUNDOS ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`⏳ Jackson, aguarda 40 segundos. Abre a tela de conexão no Messenger...`);
        
        setTimeout(async () => {
            try {
                console.log(`📡 Pedindo código agora...`);
                let code = await socket.requestPairingCode(numeroBot);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n=======================================\nTEU CÓDIGO É: ${code}\n=======================================\n`);
            } catch (err) { console.log("❌ Erro. Tenta de novo."); }
        }, 40000); // 40 SEGUNDOS PARA ESTABILIZAR
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("✅ CONECTADO! MANDA .key NO WHATSAPP!");
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // COMANDO ÚNICO PARA PEGAR A KEY
        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(msg.key.remoteJid, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
            } catch (e) { console.log(e); }
        }
    });
}

startBot();
