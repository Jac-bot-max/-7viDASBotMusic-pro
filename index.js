import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB IMEDIATO (PARA O RENDER NÃO MATAR O PROCESSO)
const app = express();
app.get('/', (req, res) => res.send('Motor de Notificação Ubuntu Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // RESET TOTAL: Limpa lixo para o sinal de notificação ser forte
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // CAPACIDADE DE NOTIFICAÇÃO (O que funcionou no seu celular):
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        // ==========================================================
        // ⚡ CONFIGURAÇÃO NITRO (CONEXÃO EM 5 SEGUNDOS) ⚡
        // ==========================================================
        shouldSyncHistoryMessage: () => false, // PROIBIDO baixar mensagens antigas
        syncFullHistory: false,                // DESATIVA sincronização completa
        markOnlineOnConnect: true,             // Entra online imediatamente
        linkPreviewImageThumbnailWidth: 0,     // Não carrega imagens pesadas
        connectTimeoutMs: 60000                // Não desiste da conexão
    });

    // O TEU NÚMERO DO BOT
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 Solicitando notificação para o 84...`);
        // Espera apenas 7 segundos para o servidor estabilizar
        await delay(7000); 
        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n=======================================\nCÓDIGO DE PAREAMENTO: ${code}\n=======================================\n`);
        } catch (e) { console.log("Erro ao pedir código."); }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO EM 5 SEGUNDOS! MANDA .key");
        }
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                await socket.sendMessage(from, { text: `🔐 *KEY NOVA:* \n\n${Buffer.from(creds).toString('base64')}` });
            } catch (e) {}
        }
        if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Nitro Ativo!" });
    });
}

startBot();
