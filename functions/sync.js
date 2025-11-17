// Copia server.js, services/, models/ e assets necessários para a pasta functions/ antes do deploy
const fs = require('fs');
const path = require('path');

function copyFile(src, dst){
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(src, dst){
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })){
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

(function main(){
  const root = path.join(__dirname, '..');
  const dstRoot = __dirname;

  const filesToCopy = [ 'server.js' ];
  const dirsToCopy = [ 'services', 'models', path.join('BicicletarioMunicipaldeJaperi','data') ];

  for (const f of filesToCopy){
    const src = path.join(root, f);
    const dst = path.join(dstRoot, f);
    if (fs.existsSync(src)) {
      console.log('[sync] copiando', src, '->', dst);
      copyFile(src, dst);
    } else {
      console.warn('[sync] arquivo não encontrado, pulando:', src);
    }
  }

  for (const d of dirsToCopy){
    const src = path.join(root, d);
    const dst = path.join(dstRoot, d);
    if (fs.existsSync(src)) {
      console.log('[sync] copiando dir', src, '->', dst);
      copyDir(src, dst);
    } else {
      console.warn('[sync] diretório não encontrado, pulando:', src);
    }
  }

  console.log('[sync] concluído.');
})();
