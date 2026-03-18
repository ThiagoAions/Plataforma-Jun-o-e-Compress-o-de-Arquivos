@echo off
echo Iniciando API Ghostscript...
start "API PDF" cmd /k "C:\Users\NOTECS-84\Documents\Projetos\api-compressor-pdf"

echo Aguardando API inicializar...
timeout /t 2 /nobreak > nul

echo Iniciando AIONS Docs...
npm run dev
```

Substitua `C:\Users\NOTECS-84\Documents\Projetos\api-compressor-pdf` pelo caminho real onde está o `server.js`.

---

**Estrutura esperada:**
```
📁 aions-docs/          ← React (npm run dev → porta 5173)
📁 api-compressor-pdf/  ← Node.js (node server.js → porta 3001)
    server.js
    package.json
    uploads/