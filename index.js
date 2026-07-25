import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB (LIGAÇÃO IMEDIATA)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic - Aguardando estabilização da rede... 🇲🇿'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor Web ativo na porta ${port}`));

async function startBot() {
    // RESET TOTAL: Limpa tudo para garantir um pedido do zero absoluto
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
        console.log("🧹 Memória limpa para evitar erros de processamento.");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // BLOQUEIO TOTAL DE HISTÓRICO (ESSENCIAL PARA NÃO TRAVAR)
        shouldSyncHistoryMessage: () => false, 
        syncFullHistory: false,
        connectTimeoutMs: 60000
    });

    // --- 2. LÓGICA DE PAREAMENTO COM ESPERA DE 40 SEGUNDOS ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`⏳ Aguardando 40 segundos para estabilizar o servidor antes de pedir o código...`);
        
        setTimeout(async () => {
            console.log(`📡 Solicitando código agora para: ${numeroBot}`);
            try {
                let code = await socket.requestPairingCode(numeroBot);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n=======================================");
                console.log(`O TEU CÓDIGO É: ${code}`);
                console.log("=======================================\n");
            } catch (err) {
                console.log("❌ O WhatsApp demorou a responder. Tente novamente.");
            }
        }, 40000); // PAUSA DE 40 SEGUNDOS
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ ✅ ✅ CONECTADO COM SUCESSO! MANDA .key NO WHATSAPP!");
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

            if (text === ".key") {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, copia este código e coloca no Render!" });
            }
            
            if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Online e estável!" });

        } catch (e) { console.log(e); }
    });
}

startBot();
