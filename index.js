import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// --- SERVIDOR WEB (PARA O RENDER NÃO MATAR O BOT) ---
const app = express();
app.get('/', (req, res) => res.send('Gerador de Key Ativo!'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // Limpa qualquer erro de sessão anterior
    if (fs.existsSync('./session_data')) fs.rmSync('./session_data', { recursive: true, force: true });

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Browser que costuma mandar notificação mais rápido
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DE NOTIFICAÇÃO ---
    if (!socket.authState.creds.registered) {
        const numero = process.env.NUMERO_BOT; // Certifica-te que no Render está: 258877338300
        if (numero) {
            await delay(10000); // Espera 10s para a rede estabilizar
            try {
                const code = await socket.requestPairingCode(numero.replace(/[^0-9]/g, ''));
                console.log(`\n=======================================\nSEU CÓDIGO: ${code}\n=======================================\n`);
            } catch (e) { console.log("Erro ao pedir código. Faz redeploy."); }
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("✅ CONECTADO! MANDA .key AGORA!");
        if (u.connection === "close") startBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // ÚNICO COMANDO: .key (Para gerar a tua SESSION_ID)
        if (text.toLowerCase() === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Copia este código e guarda-o bem!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao ler credenciais." }); }
        }
        
        if (text.toLowerCase() === ".ping") await socket.sendMessage(from, { text: "🛰️ Online!" });
    });
}

startBot();
