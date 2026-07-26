import express from 'express';
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Motor de Conexão Rápida Ativo! 🇲🇿'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

async function startBot() {
    // Só limpa se não estiver registado para evitar loops
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        // --- BLOQUEIO AGRESSIVO DE HISTÓRICO (PARA NÃO TRAVAR NO PROCESSANDO) ---
        shouldSyncHistoryMessage: () => false, 
        syncFullHistory: false,
        linkPreviewImageThumbnailWidth: 192,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000
    });

    // SÓ PEDE CÓDIGO SE TIVER A VARIÁVEL "NUMERO_BOT" CONFIGURADA NO RENDER
    const numeroBot = process.env.NUMERO_BOT; 

    if (!socket.authState.creds.registered && numeroBot) {
        console.log(`📡 Solicitando código para: ${numeroBot}`);
        await delay(15000); // Espera o Render estabilizar
        try {
            let code = await socket.requestPairingCode(numeroBot.replace(/[^0-9]/g, ''));
            console.log(`\n=======================================\nCÓDIGO: ${code}\n=======================================\n`);
        } catch (err) { console.log("Erro ao pedir código. Faz redeploy."); }
    } else if (!socket.authState.creds.registered && !numeroBot) {
        console.log("⚠️ Aguardando configuração do NUMERO_BOT no Render para solicitar código.");
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "open") {
            console.log("✅ CONECTADO COM SUCESSO!");
        }
        if (u.connection === "close") startBot();
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
            } catch (e) { await socket.sendMessage(msg.key.remoteJid, { text: "Erro ao gerar chave." }); }
        }
    });
}
startBot();
