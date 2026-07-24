import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// --- 1. LIGAR SERVIDOR IMEDIATO (PARA O RENDER NÃO MATAR O PROCESSO) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Aguardando pareamento...'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor Web ativo na porta ${port}`));

async function startBot() {
    // LIMPEZA DE CACHE (Para forçar a vinda do novo código)
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        // ESTA CONFIGURAÇÃO ABAIXO É O QUE FAZ A NOTIFICAÇÃO CHEGAR:
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        shouldSyncHistoryMessage: () => false
    });

    // --- 2. LÓGICA DE NOTIFICAÇÃO (IGUAL AO QUE FUNCIONOU) ---
    if (!socket.authState.creds.registered) {
        const numeroRaw = process.env.NUMERO_BOT; 
        
        if (numeroRaw) {
            const numeroLimpo = numeroRaw.replace(/[^0-9]/g, ''); 
            console.log(`📡 Solicitando notificação para: ${numeroLimpo}...`);

            // Espera 15 segundos (O Render precisa desse tempo para estabilizar a rede)
            setTimeout(async () => {
                try {
                    let code = await socket.requestPairingCode(numeroLimpo);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log("\n=======================================");
                    console.log(`CÓDIGO DE PAREAMENTO: ${code}`);
                    console.log("=======================================\n");
                } catch (err) {
                    console.log("❌ Erro ao pedir código. Reiniciando...");
                    startBot();
                }
            }, 15000); 
        } else {
            console.log("❌ ERRO: Coloque o seu número na variável NUMERO_BOT no Render!");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            const status = lastDisconnect?.error?.output?.statusCode;
            if (status !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log("✅ ✅ CONECTADO! MANDE O COMANDO .key NO WHATSAPP!");
        }
    });

    // --- 3. COMANDO PARA GERAR A CHAVE (PARA SALVAR NO RENDER DEPOIS) ---
    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID NOVA:*\n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, copie este código e salve na variável SESSION_ID do Render para nunca mais precisar de notificação!" });
            } catch (e) { await socket.sendMessage(from, { text: "❌ Erro ao gerar chave." }); }
        }
    });
}

startBot();
