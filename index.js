import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB PARA O RENDER (MUITO IMPORTANTE)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Aguardando conexão do Jackson@7Vidas...'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

async function startBot() {
    // Limpa cache antigo para não dar erro de pareamento
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
        // CONFIGURAÇÃO DE NAVEGADOR PARA NOTIFICAÇÃO ESTÁVEL
        browser: ["Mac OS", "Chrome", "101.0.4951.67"],
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DO CÓDIGO DE PAREAMENTO ---
    if (!socket.authState.creds.registered) {
        const numero = process.env.NUMERO_BOT; // Certifique-se que no Render está: 258877338300
        if (numero) {
            console.log(`📡 Solicitando notificação para: ${numero}`);
            // Esperamos o servidor estabilizar 10 segundos
            await delay(10000);
            try {
                let code = await socket.requestPairingCode(numero.replace(/[^0-9]/g, ''));
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n=======================================");
                console.log(`CÓDIGO PARA O WHATSAPP: ${code}`);
                console.log("=======================================\n");
            } catch (err) {
                console.log("❌ Erro ao solicitar código. Reiniciando deploy...");
            }
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
            console.log("✅ CONECTADO! AGORA DIGITE .key NO SEU WHATSAPP");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

            // COMANDO PARA GERAR A KEY (SESSION_ID)
            if (text === ".key") {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA NOVA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Copie o código acima e cole no Render para o bot nunca mais desligar!" });
            }
            
            if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Online!" });

        } catch (e) { console.log(e); }
    });
}

startBot();
