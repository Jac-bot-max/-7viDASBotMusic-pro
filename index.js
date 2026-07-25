import express from 'express';
import makeWASocket, { useMultiFileAuthState, delay, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// --- 1. LIGAR O CORAÇÃO DO RENDER (PORTA 10000) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Aguardando Notificação no seu Celular...'));
app.listen(port, '0.0.0.0', () => console.log(`✅ 1. Servidor ativo na porta ${port}`));

async function startBot() {
    // 2. RESET TOTAL (Apaga qualquer rastro que impeça a notificação)
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
        console.log("🧹 2. Cache antigo limpo para forçar notificação.");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        // ESTA LINHA ABAIXO É O SEGREDO PARA A NOTIFICAÇÃO CHEGAR:
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        shouldSyncHistoryMessage: () => false
    });

    // --- 3. LÓGICA PARA FAZER O WHATSAPP VIBRAR COM O CÓDIGO ---
    const numeroBot = process.env.NUMERO_BOT; // Certifica-te que está 258... no Render

    if (numeroBot && !socket.authState.creds.registered) {
        const numLimpo = numeroBot.replace(/[^0-9]/g, '');
        console.log(`📡 3. Solicitando notificação oficial para: ${numLimpo}`);

        // Esperamos 20 segundos para o servidor estabilizar 100%
        setTimeout(async () => {
            try {
                const code = await socket.requestPairingCode(numLimpo);
                const codeFormatado = code?.match(/.{1,4}/g)?.join("-") || code;
                
                console.log("\n=======================================");
                console.log(`CÓDIGO DE PAREAMENTO: ${codeFormatado}`);
                console.log("=======================================\n");
                console.log("👉 Se a notificação não apareceu, abra o WhatsApp > Aparelhos Conectados > Conectar com número.");
            } catch (err) {
                console.log("❌ Erro ao pedir código. Reiniciando o Deploy...");
            }
        }, 20000); 
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ ✅ ✅ CONECTADO! AGORA DIGITE .key NO WHATSAPP");
        }
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionID = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SESSION_ID PARA O RENDER:*\n\n${sessionID}` });
                await socket.sendMessage(from, { text: "✅ Jackson, guarda esta chave e mete no Render para o bot nunca mais desligar!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao ler a chave." }); }
        }
    });
}

startBot();
