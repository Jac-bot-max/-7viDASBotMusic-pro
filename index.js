import express from 'express';
import makeWASocket, { useMultiFileAuthState, delay, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('7viDASBotMusic - Resgate Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // RESET TOTAL: Limpa lixo para o código novo ser gerado
    if (fs.existsSync('./session_data')) fs.rmSync('./session_data', { recursive: true, force: true });

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // DISFARCE MOBILE (Melhor para quem tem 2 Whatsapps no mesmo fone)
        browser: ["Chrome (Android)", "Chrome", "114.0.5735.196"],
        shouldSyncHistoryMessage: () => false, // BLOQUEIA HISTÓRICO PARA NÃO TRAVAR
        syncFullHistory: false
    });

    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 Solicitando código para o WhatsApp Messenger: ${numeroBot}`);
        // Esperamos 20 segundos para dar tempo de abrires a app certa
        setTimeout(async () => {
            try {
                let code = await socket.requestPairingCode(numeroBot);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n=======================================");
                console.log(`CÓDIGO DE PAREAMENTO: ${code}`);
                console.log("=======================================\n");
            } catch (err) { console.log("Erro. Tente o Manual Deploy novamente."); }
        }, 20000);
    }

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("✅ CONECTADO! MANDE .key NO WHATSAPP!");
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation?.toLowerCase() === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                await socket.sendMessage(msg.key.remoteJid, { text: `🔐 *SUA SESSION_ID:* \n\n${Buffer.from(creds).toString('base64')}` });
            } catch (e) { console.log(e); }
        }
    });
}
startBot();
