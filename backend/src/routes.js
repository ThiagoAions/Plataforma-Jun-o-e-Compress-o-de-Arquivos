const express = require('express');
const multer  = require('multer');
const { comprimirPDF, converterOffice, checarStatus } = require('./controllers');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/comprimir', upload.single('pdf'), comprimirPDF);
router.post('/converter', upload.single('arquivo'), converterOffice);
router.get('/status', checarStatus);

module.exports = router;