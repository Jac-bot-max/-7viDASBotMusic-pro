import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Diagnóstico @7viDASBotMusic Ativo'));
app.listen(port, '0.0.0.0', () => console.log(`✅ 1. Servidor Web ativo na porta ${port}`));

async function startBot() {
    console.log("✅ 2. Iniciando processo de conexão...");

    // Limpeza de cache antigo para evitar erros
    if (fs.existsSync('./session_data/creds.json')) {
        console.log("⚠️ Limpando sessão antiga do disco...");
        fs.unlinkSync('./session_data/creds.json');
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID) {
        console.log("✅ 3. SESSION_ID encontrada. Tentando restaurar...");
        try {
            const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
            if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data', { recursive: true });
            fs.writeFileSync('./session_data/creds.json', decoded);
            console.log("📂 4. Ficheiro de credenciais criado com sucesso!");
        } catch (e) {
            console.log("❌ ERRO CRÍTICO: Chave SESSION_ID inválida ou mal formatada!");
        }
    } else {
        console.log("⚠️ 3. Nenhuma SESSION_ID configurada no Render.");
    }

    console.log("✅ 5. Abrindo Socket do WhatsApp...");
    const socket = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect, qr } = u;
        
        if (qr) console.log("⚠️ ALERTA: O bot não usou a sua chave e está a pedir QR Code!");

        if (connection === "close") {
            console.log("⚠️ Conexão fechada. Motivo:", lastDisconnect?.error?.message);
            startBot();
        } else if (connection === "open") {
            console.log("✅ 6. @7viDASBotMusic: CONECTADO E PRONTO!");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

            console.log(`📩 Mensagem recebida: ${text}`);

            if (text === ".ping") {
                await socket.sendMessage(from, { text: "🛰️ Jackson Beatz Online e Respondendo!" });
            }
        } catch (e) { console.log("Erro na mensagem:", e); }
    });
}

startBot();
