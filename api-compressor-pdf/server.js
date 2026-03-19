const express = require('express');
const multer  = require('multer');
const { execFile, exec } = require('child_process');
const path = require('path');
const fs   = require('fs');
const cors = require('cors');

const app  = express();
const port = 3001;

app.use(cors());
const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ─── Caminhos dos executáveis ────────────────────────────────────────────────
const GS_EXE = 'C:\\Program Files\\gs\\gs10.07.0\\bin\\gswin64c.exe';

// LibreOffice: tenta os caminhos mais comuns de instalação
const LO_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
];
const LO_EXE = LO_PATHS.find(p => fs.existsSync(p)) || LO_PATHS[0];

// ─── Rota: Comprimir PDF ─────────────────────────────────────────────────────
app.post('/comprimir', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum arquivo.');

  const inputFilePath  = req.file.path;
  const outputFilePath = path.join('uploads', `comprimido_${req.file.filename}.pdf`);
  const quality        = parseInt(req.body.quality) || 50;

  let dpi, pdfSettings;
  if (quality <= 20)      { dpi = 72;  pdfSettings = '/screen';  }
  else if (quality <= 60) { dpi = 150; pdfSettings = '/ebook';   }
  else                    { dpi = 300; pdfSettings = '/printer';  }

  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${pdfSettings}`,
    '-dNOPAUSE', '-dQUIET', '-dBATCH',
    '-dColorImageDownsampleType=/Bicubic',
    `-dColorImageResolution=${dpi}`,
    '-dGrayImageDownsampleType=/Bicubic',
    `-dGrayImageResolution=${dpi}`,
    `-dMonoImageResolution=${dpi}`,
    '-dDownsampleColorImages=true',
    '-dDownsampleGrayImages=true',
    '-dDownsampleMonoImages=true',
    '-dColorImageDownsampleThreshold=1.0',
    '-dGrayImageDownsampleThreshold=1.0',
    '-dMonoImageDownsampleThreshold=1.0',
    '-dAutoFilterColorImages=false',
    '-dAutoFilterGrayImages=false',
    '-dColorImageFilter=/DCTEncode',
    '-dGrayImageFilter=/DCTEncode',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dEmbedAllFonts=false',
    '-dDetectDuplicateImages=true',
    `-sOutputFile=${outputFilePath}`,
    inputFilePath,
  ];

  console.log(`[GS] Comprimindo... quality=${quality} | DPI=${dpi} | Settings=${pdfSettings}`);

  execFile(GS_EXE, args, (error, stdout, stderr) => {
    if (error) {
      console.error(`[GS] Erro: ${error.message}`);
      try { fs.unlinkSync(inputFilePath); } catch (_) {}
      return res.status(500).send('Erro na compressão: ' + error.message);
    }
    res.download(outputFilePath, 'pdf_comprimido.pdf', () => {
      try { fs.unlinkSync(inputFilePath);  } catch (_) {}
      try { fs.unlinkSync(outputFilePath); } catch (_) {}
    });
  });
});

// ─── Rota: Converter Office → PDF ───────────────────────────────────────────
app.post('/converter', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');

  const originalName = req.file.originalname || 'documento';
  const ext = path.extname(originalName).toLowerCase();
  const allowed = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];

  if (!allowed.includes(ext)) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).send(`Formato não suportado: ${ext}`);
  }

  // Renomeia com extensão correta (multer salva sem extensão)
  const inputWithExt = req.file.path + ext;
  fs.renameSync(req.file.path, inputWithExt);

  const outputDir = path.resolve('uploads');

  // LibreOffice converte e salva o PDF na mesma pasta do input
  const args = [
    '--headless',
    '--convert-to', 'pdf',
    '--outdir', outputDir,
    inputWithExt,
  ];

  console.log(`[LO] Convertendo ${originalName} → PDF`);
  console.log(`[LO] Executável: ${LO_EXE}`);

  execFile(LO_EXE, args, { timeout: 60000 }, (error, stdout, stderr) => {
    try { fs.unlinkSync(inputWithExt); } catch (_) {}

    if (error) {
      console.error(`[LO] Erro: ${error.message}`);
      console.error(`[LO] stderr: ${stderr}`);
      return res.status(500).send(
        'Erro na conversão. Verifique se o LibreOffice está instalado.\n' + error.message
      );
    }

    // LibreOffice gera o PDF com o mesmo nome base do arquivo original
    const baseName   = path.basename(inputWithExt, ext);
    const outputFile = path.join(outputDir, baseName + '.pdf');

    if (!fs.existsSync(outputFile)) {
      console.error(`[LO] PDF não encontrado em: ${outputFile}`);
      return res.status(500).send('PDF não foi gerado. Verifique a instalação do LibreOffice.');
    }

    const downloadName = path.basename(originalName, ext) + '.pdf';
    console.log(`[LO] Sucesso → ${outputFile}`);

    res.download(outputFile, downloadName, () => {
      try { fs.unlinkSync(outputFile); } catch (_) {}
    });
  });
});

// ─── Rota: Health check ──────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  const gsOk = fs.existsSync(GS_EXE);
  const loOk = fs.existsSync(LO_EXE);
  res.json({
    ghostscript: { ok: gsOk, path: GS_EXE },
    libreoffice: { ok: loOk, path: LO_EXE },
  });
});

app.listen(port, () => {
  console.log(`\n API AIONS Docs rodando na porta ${port}`);
  console.log(` Ghostscript : ${fs.existsSync(GS_EXE) ? 'OK' : 'NAO ENCONTRADO'} → ${GS_EXE}`);
  console.log(` LibreOffice : ${fs.existsSync(LO_EXE) ? 'OK' : 'NAO ENCONTRADO'} → ${LO_EXE}\n`);
});