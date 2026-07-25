import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Sistema de Resgate Online!'));
app.listen(port, '0.0.0.0', () => console.log(`✅ 1. Servidor Web ativo na porta ${port}`));

async function startBot() {
    console.log("🔄 2. Iniciando limpeza de cache...");
    
    // FORÇAR LIMPEZA: Apaga a pasta de sessão toda vez que iniciar para não dar erro
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
        console.log("🧹 3. Cache limpo com sucesso!");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    console.log("📡 4. Motor do WhatsApp carregado.");

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DE CÓDIGO FORÇADA ---
    const numero = process.env.NUMERO_BOT; 

    if (numero) {
        console.log(`📲 5. Tentando enviar código para o número: ${numero}`);
        
        // Esperamos 15 segundos para garantir que a rede do Render está pronta
        await delay(15000); 

        try {
            const code = await socket.requestPairingCode(numero.replace(/[^0-9]/g, ''));
            console.log("\n=======================================");
            console.log(`CÓDIGO DE 8 DÍGITOS: ${code}`);
            console.log("=======================================\n");
            console.log("💡 Se não apareceu notificação, abra o WhatsApp > Aparelhos Conectados > Conectar com número.");
        } catch (err) {
            console.log("❌ Erro ao solicitar código. Verifique se o número está certo no Render.");
        }
    } else {
        console.log("❌ ERRO: Variável NUMERO_BOT não encontrada nas configurações do Render!");
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ ✅ 6. CONECTADO! AGORA DIGITE .key NO WHATSAPP!");
        }
        if (u.connection === "close") {
            console.log("⚠️ Conexão fechada. Reiniciando...");
            startBot();
        }
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
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, guarde este código e salve no Render!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao ler chave." }); }
        }
    });
}

startBot();
