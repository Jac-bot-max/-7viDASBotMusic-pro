import express from 'express';
import makeWASocket, { useMultiFileAuthState, delay, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB (ESTABILIDADE RENDER)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic - A aguardar pareamento moçambicano... 🇲🇿'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

async function startBot() {
    // RESET TOTAL: Garante que o WhatsApp envie um código NOVO
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
        console.log("🧹 Memória limpa para novo pareamento.");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        // SIMULAÇÃO DE NAVEGADOR (O segredo da notificação)
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DE NOTIFICAÇÃO ---
    const numeroParaParear = process.env.NUMERO_BOT; 

    if (numeroParaParear && !socket.authState.creds.registered) {
        console.log(`📡 A solicitar código para o bot: ${numeroParaParear}`);

        // Esperamos 25 segundos para a rede do Render estabilizar
        setTimeout(async () => {
            try {
                let code = await socket.requestPairingCode(numeroParaParear.trim());
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                
                console.log("\n=======================================");
                console.log(`CÓDIGO PARA O BOT (848786486): ${code}`);
                console.log("=======================================\n");
                console.log("👉 Abre o WhatsApp do Bot > Aparelhos Conectados > Conectar com número agora!");
            } catch (err) {
                console.log("❌ Erro. Faz 'Clear cache and redeploy' no Render.");
            }
        }, 25000); 
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("✅ CONECTADO! AGORA MANDA .key NO WHATSAPP!");
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
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ JACKSON, salva esta chave no Render!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao ler a chave." }); }
        }
    });
}

startBot();
