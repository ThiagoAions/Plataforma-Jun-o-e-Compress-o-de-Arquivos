const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { GS_EXE, LO_EXE } = require('./config');

const comprimirPDF = (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum arquivo.');

  const inputFilePath  = req.file.path;
  const outputFilePath = path.join('uploads', `comprimido_${req.file.filename}.pdf`);
  const quality        = parseInt(req.body.quality) || 50;

  let dpi, pdfSettings;
  if (quality <= 20)      { dpi = 72;  pdfSettings = '/screen';  }
  else if (quality <= 60) { dpi = 150; pdfSettings = '/ebook';   }
  else                    { dpi = 300; pdfSettings = '/printer';  }

  const args = [
    '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', `-dPDFSETTINGS=${pdfSettings}`,
    '-dNOPAUSE', '-dQUIET', '-dBATCH', '-dColorImageDownsampleType=/Bicubic',
    `-dColorImageResolution=${dpi}`, '-dGrayImageDownsampleType=/Bicubic',
    `-dGrayImageResolution=${dpi}`, `-dMonoImageResolution=${dpi}`,
    '-dDownsampleColorImages=true', '-dDownsampleGrayImages=true',
    '-dDownsampleMonoImages=true', '-dColorImageDownsampleThreshold=1.0',
    '-dGrayImageDownsampleThreshold=1.0', '-dMonoImageDownsampleThreshold=1.0',
    '-dAutoFilterColorImages=false', '-dAutoFilterGrayImages=false',
    '-dColorImageFilter=/DCTEncode', '-dGrayImageFilter=/DCTEncode',
    '-dCompressFonts=true', '-dSubsetFonts=true', '-dEmbedAllFonts=false',
    '-dDetectDuplicateImages=true', `-sOutputFile=${outputFilePath}`, inputFilePath,
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
};

const converterOffice = (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');

  const originalName = req.file.originalname || 'documento';
  const ext = path.extname(originalName).toLowerCase();
  const allowed = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];

  if (!allowed.includes(ext)) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).send(`Formato não suportado: ${ext}`);
  }

  const inputWithExt = req.file.path + ext;
  fs.renameSync(req.file.path, inputWithExt);
  const outputDir = path.resolve('uploads');

  const args = ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputWithExt];

  console.log(`[LO] Convertendo ${originalName} → PDF`);
  console.log(`[LO] Executável: ${LO_EXE}`);

  execFile(LO_EXE, args, { timeout: 60000 }, (error, stdout, stderr) => {
    try { fs.unlinkSync(inputWithExt); } catch (_) {}

    if (error) {
      console.error(`[LO] Erro: ${error.message}`);
      console.error(`[LO] stderr: ${stderr}`);
      return res.status(500).send('Erro na conversão.\n' + error.message);
    }

    const baseName   = path.basename(inputWithExt, ext);
    const outputFile = path.join(outputDir, baseName + '.pdf');

    if (!fs.existsSync(outputFile)) {
      console.error(`[LO] PDF não encontrado em: ${outputFile}`);
      return res.status(500).send('PDF não foi gerado.');
    }

    const downloadName = path.basename(originalName, ext) + '.pdf';
    console.log(`[LO] Sucesso → ${outputFile}`);

    res.download(outputFile, downloadName, () => {
      try { fs.unlinkSync(outputFile); } catch (_) {}
    });
  });
};

const checarStatus = (req, res) => {
  const gsOk = fs.existsSync(GS_EXE);
  const loOk = fs.existsSync(LO_EXE);
  res.json({
    ghostscript: { ok: gsOk, path: GS_EXE },
    libreoffice: { ok: loOk, path: LO_EXE },
  });
};

module.exports = { comprimirPDF, converterOffice, checarStatus };