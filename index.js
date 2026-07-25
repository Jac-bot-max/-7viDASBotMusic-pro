import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// --- 1. LIGAR O SERVIDOR IMEDIATAMENTE (PORTA 10000) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic - Resgate de Meia-Noite! 🇲🇿'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

async function startBot() {
    // RESET TOTAL: Limpa qualquer erro que impeça o código novo
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
        console.log("🧹 Memória limpa!");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        // DISFARCE DE MACBOOK/SAFARI (O WhatsApp confia mais para mandar código)
        browser: ["Mac OS", "Safari", "15.0"], 
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false
    });

    // --- 2. LÓGICA DE NOTIFICAÇÃO (ESPERA DE 30 SEGUNDOS) ---
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 Preparando sinal para o bot (848786486)...`);
        console.log(`⏳ Jackson, aguarda 30 segundos na tela de conexão...`);

        // Tempo para o Render estabilizar e o WhatsApp não bloquear
        setTimeout(async () => {
            try {
                let code = await socket.requestPairingCode(numeroBot);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n=======================================");
                console.log(`O TEU CÓDIGO É: ${code}`);
                console.log("=======================================\n");
            } catch (err) {
                console.log("❌ Ocorreu um erro no pedido. Reinicie o Deploy.");
            }
        }, 30000); 
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("✅ CONECTADO! ESCREVA .key NO WHATSAPP!");
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // COMANDO PARA GERAR A KEY NOVA
        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID NOVA:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, guarda esse código e coloca no Render!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao ler a chave." }); }
        }
    });
}

startBot();
