import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB IMEDIATO (VITAL PARA O RENDER)
const app = express();
app.get('/', (req, res) => res.send('Motor de Conexão Relâmpago Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // RESET TOTAL: Limpa tudo para garantir uma conexão sem "lixo"
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), // Silêncio total para economizar memória
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // ==========================================================
        // ⚡ AS LINHAS ABAIXO FAZEM A CONEXÃO SER INSTANTÂNEA ⚡
        // ==========================================================
        shouldSyncHistoryMessage: () => false, // PROÍBE baixar conversas antigas
        syncFullHistory: false,                // DESATIVA sincronização completa
        markOnlineOnConnect: true,             // Mostra online na hora
        connectTimeoutMs: 60000,               // Tempo de espera maior
        defaultQueryTimeoutMs: 0               // Não espera resposta lenta
    });

    // --- SOLICITAÇÃO DO CÓDIGO ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 Solicitando notificação para o bot: ${numeroBot}`);
        await delay(10000); // Espera 10s para o Render estabilizar

        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`TEU CÓDIGO É: ${code}`);
            console.log("=======================================\n");
        } catch (err) {
            console.log("❌ Erro no pedido. Tente novamente.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ CONECTADO INSTANTANEAMENTE!");
            console.log("👉 MANDE .key AGORA NO WHATSAPP PARA PEGAR SUA CHAVE!");
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

            // COMANDO PARA PEGAR A KEY (SESSION_ID)
            if (text === ".key") {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, copie esta chave e salve no Render!" });
            }
            
            if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Jackson Beatz Online!" });

        } catch (e) { console.log(e); }
    });
}

startBot();
