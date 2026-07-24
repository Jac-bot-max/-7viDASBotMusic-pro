const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('OK')); // Apenas responde OK (isso resolve o erro do Cron-job)
app.listen(port, '0.0.0.0', () => console.log(`Servidor na porta ${port}`));
