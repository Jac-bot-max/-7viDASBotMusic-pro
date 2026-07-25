import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

// 1. SERVIDOR WEB PARA O RENDER NÃO MATAR O BOT
const app = express();
app.get('/', (req, res) => res.send('7viDASBotMusic - Gerador de Conexão Ativo 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log("✅ Servidor Web Online"));

async function conectarBot() {
    // Limpa cache antigo para garantir nova notificação
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // ESTE DISFARCE ABAIXO É O QUE ENVIA A NOTIFICAÇÃO
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        shouldSyncHistoryMessage: () => false
    });

    // --- LÓGICA DO CÓDIGO DE PAREAMENTO ---
    // O número deve ser o do bot: 258848786486
    const numeroBot = "258848786486"; 

    if (!socket.authState.creds.registered) {
        console.log(`📡 Solicitando código para o 84: ${numeroBot}`);
        
        // Esperamos 10 segundos para a rede do Render estabilizar
        setTimeout(async () => {
            try {
                let code = await socket.requestPairingCode(numeroBot);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n=======================================");
                console.log(`CÓDIGO DE PAREAMENTO: ${code}`);
                console.log("=======================================\n");
            } catch (err) {
                console.log("❌ Erro ao pedir código. Tente dar 'Manual Deploy' novamente.");
            }
        }, 10000);
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO COM SUCESSO!");
            console.log("👉 AGORA ESCREVA .key NO WHATSAPP PARA TER SUA SESSION_ID");
        }
        if (u.connection === "close") conectarBot();
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // Comando para gerar a chave e salvar no Render depois
        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Jackson, guarde este código e coloque no Render!" });
            } catch (e) { await socket.sendMessage(from, { text: "Erro ao gerar chave." }); }
        }
        
        if (text === ".ping") await socket.sendMessage(from, { text: "🛰️ Estou ativo!" });
    });
}

conectarBot();
