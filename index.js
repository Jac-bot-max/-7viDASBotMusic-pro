import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic - Gerador de Chave Ativo!'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

async function startBot() {
    // LIMPEZA TOTAL PARA FORÇAR NOVO PAREAMENTO
    if (fs.existsSync('./session_data')) {
        fs.rmSync('./session_data', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Chrome', '1.0.0']
    });

    // --- LÓGICA DE PAREAMENTO ---
    const meuNumero = process.env.NUMERO_BOT; // Pega o número que você salvou no Render
    
    if (!socket.authState.creds.registered) {
        if (meuNumero) {
            console.log(`📡 Pedindo código para ${meuNumero}...`);
            setTimeout(async () => {
                try {
                    let code = await socket.requestPairingCode(meuNumero.replace(/[^0-9]/g, ''));
                    console.log("\n=======================================");
                    console.log(`TEU CÓDIGO É: ${code}`);
                    console.log("=======================================\n");
                } catch (e) { console.log("Erro ao pedir código. Reinicie o Deploy."); }
            }, 10000); // 10 segundos para o Render estabilizar
        } else {
            console.log("❌ ERRO: Variável NUMERO_BOT vazia no Render!");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ ✅ ✅ CONECTADO! AGORA MANDE .key NO WHATSAPP!");
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // COMANDO PARA GERAR A KEY
        if (text === ".key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: `🔐 *SUA NOVA SESSION_ID:* \n\n${sessionString}` });
                await socket.sendMessage(from, { text: "✅ Copie o texto acima e cole na variável SESSION_ID do Render!" });
            } catch (e) {
                await socket.sendMessage(from, { text: "❌ Erro ao ler arquivos de sessão." });
            }
        }
    });
}
startBot();
