const express = require('express');
const multer  = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const cors = require('cors');

const app  = express();
const port = 3001;

app.use(cors());
const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.post('/comprimir', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo.');

    const inputFilePath  = req.file.path;
    const outputFilePath = path.join('uploads', `comprimido_${req.file.filename}.pdf`);
    const quality        = parseInt(req.body.quality) || 50;

    const gsExe = 'C:\\Program Files\\gs\\gs10.07.0\\bin\\gswin64c.exe';

    let dpi, pdfSettings, jpegQuality;

    if (quality <= 20) {
        dpi         = 72;
        pdfSettings = '/screen';
        jpegQuality = 30;
    } else if (quality <= 60) {
        dpi         = 150;
        pdfSettings = '/ebook';
        jpegQuality = 60;
    } else {
        dpi         = 300;
        pdfSettings = '/printer';
        jpegQuality = 85;
    }

    // Usa execFile com array de args — sem problemas de aspas no Windows
    const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${pdfSettings}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
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
        `-dJPEGQ=${jpegQuality}`,
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        '-dEmbedAllFonts=false',
        '-dDetectDuplicateImages=true',
        `-sOutputFile=${outputFilePath}`,
        inputFilePath,
    ];

    console.log(`Comprimindo... quality=${quality} | DPI=${dpi} | Settings=${pdfSettings} | JPEG=${jpegQuality}%`);

    execFile(gsExe, args, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro GS: ${error.message}`);
            console.error(`stderr: ${stderr}`);
            return res.status(500).send('Erro na compressão: ' + error.message);
        }
        res.download(outputFilePath, 'pdf_comprimido.pdf', () => {
            try { fs.unlinkSync(inputFilePath);  } catch (_) {}
            try { fs.unlinkSync(outputFilePath); } catch (_) {}
        });
    });
});

app.listen(port, () => {
    console.log(`API rodando na porta ${port}`);
});