import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic - Aguardando Pareamento...'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor Web ativo na porta ${port}`));

async function startBot() {
    // 1. LIMPEZA DE SESSÃO ANTIGA (Para forçar novo código)
    if (fs.existsSync('./session_data/creds.json')) {
        const stats = fs.statSync('./session_data/creds.json');
        // Se o arquivo tiver erro, nós apagamos para resetar
        if (stats.size < 100) fs.unlinkSync('./session_data/creds.json');
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Browser padrão para código chegar rápido
        shouldSyncHistoryMessage: () => false
    });

    // --- 2. LÓGICA DE NOTIFICAÇÃO FORÇADA ---
    if (!socket.authState.creds.registered) {
        const numeroRaw = process.env.NUMERO_BOT || process.env.NUMERO_DO_BOT;
        
        if (numeroRaw) {
            const numeroLimpo = numeroRaw.replace(/[^0-9]/g, ''); // Remove qualquer símbolo
            console.log(`📡 Tentando enviar notificação para: ${numeroLimpo}...`);

            // Esperamos 15 segundos para o servidor do Render estabilizar a rede
            setTimeout(async () => {
                try {
                    let code = await socket.requestPairingCode(numeroLimpo);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log("\n=======================================");
                    console.log(`CÓDIGO DE PAREAMENTO: ${code}`);
                    console.log("=======================================\n");
                    console.log("⚠️ SE A NOTIFICAÇÃO NÃO CHEGOU: Vá no WhatsApp > Aparelhos Conectados > Conectar com número e digite o código acima.");
                } catch (err) {
                    console.log("❌ Erro ao solicitar código. Reiniciando em 10s...");
                    setTimeout(startBot, 10000);
                }
            }, 15000); 
        } else {
            console.log("❌ ERRO: Variável NUMERO_BOT não encontrada no Render.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            const status = lastDisconnect?.error?.output?.statusCode;
            if (status !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log("✅ @7viDASBotMusic: CONECTADO COM SUCESSO!");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Estou online!" });
    });
}

startBot();
