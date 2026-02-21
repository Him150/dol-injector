import fs from 'fs';
import path from 'path';

console.log(process.env.WORK_FOLDER_PATH, process.env.BUILD_FOLDER_PATH);

const distFile = path.resolve('./dist/injector.js');
const buildFolder = process.env.BUILD_FOLDER_PATH ? path.resolve('../' + process.env.BUILD_FOLDER_PATH) : 'build';

if (!fs.existsSync(distFile)) {
  console.error('Build file not found');
  process.exit(1);
}

const injectorCode = fs.readFileSync(distFile, 'utf-8').toString();

// const scriptTag = `<!-- DOL INJECTOR START -->
// <script>${injectorCode}</script>
// <!-- DOL INJECTOR END -->`;
const scriptTag = `<!-- DOL INJECTOR START -->
<script src="./injector.js"></script>
<!-- DOL INJECTOR END -->`;
fs.writeFileSync(path.resolve(buildFolder, './injector.js'), injectorCode);

const cspMetaTest = /<meta[^\<]*?["']Content-Security-Policy["'][^\>]*?>/is;
const gameVersionTest = '#gameVersionDisplay {';
const insertTest = '</head>';

replace('Degrees of Lewdity VERSION.html.mod.html');
replace('Degrees of Lewdity VERSION.html.mod-polyfill.html');

function replace(filePath) {
  let filePathSolved = path.resolve(buildFolder, filePath);
  console.log('Start replacing', filePathSolved);

  if (fs.existsSync(filePathSolved)) {
    let html = fs.readFileSync(filePathSolved, 'utf-8').toString();
    // 如果之前已经注入，先移除旧版本
    html = html.replace(/<!-- DOL INJECTOR START -->[\s\S]*?<!-- DOL INJECTOR END -->/, '');

    if (cspMetaTest.test(html)) {
      console.log('cspMetaTest');
      html = html.replace(cspMetaTest, '');
    }
    if (new RegExp(gameVersionTest).test(html)) {
      console.log('gameVersionTest');
      html = html.replace(new RegExp(gameVersionTest), gameVersionTest + 'display:none;');
    }
    if (new RegExp(insertTest).test(html)) {
      console.log('insertTest');
      html = html.replace(new RegExp(insertTest), `${scriptTag}\n${insertTest}`);
    }
    if (process.env.BUILD_FOLDER_PATH) {
      fs.writeFileSync(filePathSolved, html);
    } else {
      fs.writeFileSync(path.resolve(buildFolder, 'modified' + filePath), html);
    }
  } else {
    console.log("File didn't exist:", filePath);
  }
}
