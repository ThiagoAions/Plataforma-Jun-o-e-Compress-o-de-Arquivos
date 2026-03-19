const express = require('express');
const cors = require('cors');
const fs = require('fs');
const routes = require('./src/routes');
const { GS_EXE, LO_EXE } = require('./src/config');

const app = express();
const port = 3001;

app.use(cors());

// Garante que a pasta de uploads existe
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Importa todas as rotas de uma vez
app.use('/', routes);

app.listen(port, () => {
  console.log(`\n🚀 API AIONS Docs rodando na porta ${port}`);
  console.log(`📦 Ghostscript : ${fs.existsSync(GS_EXE) ? 'OK' : 'NAO ENCONTRADO'} → ${GS_EXE}`);
  console.log(`📦 LibreOffice : ${fs.existsSync(LO_EXE) ? 'OK' : 'NAO ENCONTRADO'} → ${LO_EXE}\n`);
});