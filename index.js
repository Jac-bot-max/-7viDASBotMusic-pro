import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB (LIGAÇÃO IMEDIATA PARA O RENDER)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Motor de Resgate JACKSON@7VIDAS Ativo 🇲🇿'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

async function startBot() {
    // LIMPEZA DE CACHE: Apaga tudo para garantir que o código NOVO apareça
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
        // MESMO DISFARCE QUE FUNCIONOU ANTES:
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        // --- CONFIGURAÇÃO PARA NÃO TRAVAR NO "PROCESSANDO" ---
        shouldSyncHistoryMessage: () => false, 
        syncFullHistory: false,
        linkPreviewImageThumbnailWidth: 192,
        pinOldMessages: false,
        generateHighQualityLinkPreview: false
    });

    // --- LÓGICA DE NOTIFICAÇÃO ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 A solicitar código para o WhatsApp Messenger: ${numeroBot}`);
        await delay(10000); // Espera o servidor estabilizar
        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`O TEU CÓDIGO É: ${code}`);
            console.log("=======================================\n");
        } catch (err) { console.log("Erro ao pedir código."); }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ CONECTADO! ESCREVE .key NO WHATSAPP!");
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

            // COMANDO PARA GERAR A TUA CHAVE (SESSION_ID)
            if (text === ".key") {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, copia este código e salva nas variáveis do Render!" });
            }
            
            if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Online e rápido!" });

        } catch (e) { console.log(e); }
    });
}

startBot();
