import express from 'express';
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Bot em modo de repouso... No pairing.'));

app.listen(port, '0.0.0.0', () => {
    console.log("✅ Servidor online em modo silencioso. Nenhuma notificação será enviada.");
}); 













