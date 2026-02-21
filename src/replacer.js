import fs from 'fs';
import path from 'path';

console.log(process.env.WORK_FOLDER_PATH, process.env.BUILD_FOLDER_PATH);

const file = fs.readFileSync(path.resolve('./dist/injector.js')).toString();

const cspMetaTest = /<meta[^\<]*?["']Content-Security-Policy["'][^\>]*?>/is;
const gameVersionTest = '#gameVersionDisplay {';
const insertTest = '</head>';

(async () => {
  replace('index.html');
  replace('Degrees of Lewdity VERSION.html.mod.html');
  replace('Degrees of Lewdity VERSION.html.mod-polyfill.html');
})();
function replace(filePath) {
  let filePathSolved = path.resolve(
    process.env.BUILD_FOLDER_PATH ? path.resolve('../' + process.env.BUILD_FOLDER_PATH) : '',
    filePath,
  );
  if (fs.existsSync(filePathSolved)) {
    let text = fs.readFileSync(filePathSolved).toString();
    if (cspMetaTest.test(text)) {
      console.log('replace cspMetaTest');
      text = text.replace(cspMetaTest, '');
    }
    if (new RegExp(gameVersionTest).test(text)) {
      console.log('replace gameVersionTest');
      text = text.replace(new RegExp(gameVersionTest), gameVersionTest + 'display:none;');
    }
    if (new RegExp(insertTest).test(text)) {
      console.log('replace insertTest');
      text = text.replace(new RegExp(insertTest), `<script>${file}</script>\n${insertTest}`);
    }
    fs.writeFileSync(filePathSolved, text);
    return;
    fs.writeFileSync('modified' + filePath + '', text);
  } else {
    console.log("File didn't exist:", filePath);
  }
}
