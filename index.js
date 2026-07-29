import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB (ESTABILIDADE RENDER)
const app = express();
app.get('/', (req, res) => res.send('7viDASBotMusic - Conexão Relâmpago Ativa 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // RESET TOTAL: Apaga pastas antigas para não travar
    if (fs.existsSync('./session_data')) fs.rmSync('./session_data', { recursive: true, force: true });

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // ==========================================================
        // ⚡ AS LINHAS ABAIXO FAZEM A LIGAÇÃO SER INSTANTÂNEA ⚡
        // ==========================================================
        shouldSyncHistoryMessage: () => false, // BLOQUEIA mensagens antigas
        syncFullHistory: false,                // DESATIVA histórico completo
        markOnlineOnConnect: true,             // Entra online na hora
        connectTimeoutMs: 60000,               // Não desiste da conexão
        linkPreviewImageThumbnailWidth: 192    // Economiza RAM
    });

    // TEU NOVO NÚMERO (865560063)
    const numeroBot = "258865560063"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 A solicitar código para o bot: ${numeroBot}`);
        await delay(10000); // Espera o Render estabilizar

        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log("\n=======================================");
            console.log(`TEU CÓDIGO É: ${code}`);
            console.log("=======================================\n");
        } catch (err) { console.log("Erro ao pedir código."); }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO EM SEGUNDOS! MANDA .key NO WHATSAPP!");
        }
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // COMANDO PARA PEGAR A KEY
        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, copia este código e salva no Render!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao gerar chave." }); }
        }
        if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Online e sem delay!" });
    });
}
startBot();
