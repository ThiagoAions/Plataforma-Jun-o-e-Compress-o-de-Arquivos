const fs = require('fs');

const GS_EXE = 'C:\\Program Files\\gs\\gs10.07.0\\bin\\gswin64c.exe';

const LO_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
];
const LO_EXE = LO_PATHS.find(p => fs.existsSync(p)) || LO_PATHS[0];

module.exports = { GS_EXE, LO_EXE };