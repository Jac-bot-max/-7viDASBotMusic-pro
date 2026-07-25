import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Motor de Conexão Leve Ativo 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function conectarBot() {
    // Limpa a pasta para começar do zero absoluto
    if (fs.existsSync('./session_data')) fs.rmSync('./session_data', { recursive: true, force: true });

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // --- AS LINHAS ABAIXO SÃO O SEGREDO PARA NÃO TRAVAR NO PROCESSANDO ---
        shouldSyncHistoryMessage: () => false, // NÃO baixa mensagens antigas
        syncFullHistory: false,                // NÃO sincroniza histórico
        linkPreviewImageThumbnailWidth: 192,   // Economiza RAM
        pinOldMessages: false,                 // Não processa mensagens fixadas
        generateHighQualityLinkPreview: false  // Desativa previews pesados
    });

    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 Solicitando código para: ${numeroBot}`);
        await delay(10000); 
        try {
            let code = await socket.requestPairingCode(numeroBot);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n=======================================\nCÓDIGO: ${code}\n=======================================\n`);
        } catch (err) { console.log("Erro ao pedir código."); }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO! MANDA .key NO WHATSAPP!");
        }
        if (u.connection === "close") conectarBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(msg.key.remoteJid, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(msg.key.remoteJid, { text: "✅ Jackson, copia este código e salva no Render!" });
            } catch (e) { await socket.sendMessage(msg.key.remoteJid, { text: "Erro ao gerar chave." }); }
        }
    });
}
conectarBot();
