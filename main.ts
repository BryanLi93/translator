const xlsx = require("node-xlsx");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const os = require("os");
const shellPrompt = require("prompt");

// js 项目
const sourceFolderPath = "/Users/bryan/Documents/ctg/hk/nbs-pc/src/i18n/zh-cn";
const targetFolderPath = "/Users/bryan/Documents/ctg/hk/nbs-pc/src/i18n/zh-tw";
const excelFilePath = "/Users/bryan/Downloads/多语言支持.xlsx";

// ts 项目
// const sourceFolderPath =
//   "/Users/bryan/Documents/ctg/hk/mbs-web/src/i18n/Language/zh-cn";
// const targetFolderPath =
//   "/Users/bryan/Documents/ctg/hk/mbs-web/src/i18n/Language/zh-tw";
// const excelFilePath = "/Users/bryan/Documents/ctg/hk/nbs-pc/tools/i18n.xlsx";

// shellPrompt.start();
// const { sourceFolderPath, targetFolderPath, excelFilePath } = await shellPrompt.get({
//   properties: {
//     sourceFolderPath: {
//       description: "请输入参考的文件夹路径",
//       type: "string",
//       required: true,
//     },
//     targetFolderPath: {
//       description: "请输入要翻译的文件夹路径",
//       type: "string",
//       required: true,
//     },
//     excelFilePath: {
//       description: "请输入 excel 的文件路径",
//       type: "string",
//       required: true,
//     },
//   },
// });

/**
 * 读取excel文件
 */
const workSheetsFromFile = xlsx.parse(excelFilePath);
const translateSheet = workSheetsFromFile[3].data || [];
translateSheet.shift(); // 标题行
const KVArr = translateSheet.map((item) => {
  return [item[3], item[5]];
});
const translateTools = Object.fromEntries(KVArr);

/**
 * 遍历文件夹所有文件
 * @param {*} dir
 * @param {*} callback
 */
function traverseFolder(dir, callback) {
  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      traverseFolder(filePath, callback);
    } else {
      callback(filePath);
    }
  });
}

// export function getDeepValueByKeyChain(obj, keyChain) {
//   return keyChain.reduce(function (childObj, childKey) {
//     return childObj && childObj[childKey] ? childObj[childKey] : undefined
//   }, obj)
// }

// 深度遍历对象，保留 key 的链路
function traverseObj(obj, callback, keyChain) {
  Object.keys(obj).forEach((key) => {
    const newKeyChain = keyChain === undefined ? [key] : [...keyChain, key];
    if (typeof obj[key] === "object") {
      traverseObj(obj[key], callback, newKeyChain);
    } else {
      callback(newKeyChain, obj[key]);
    }
  });
}

function isNumber(val) {
  return !isNaN(Number(val));
}

/**
 * 若 key 值为数字，且对象未创建时，创建对象
 * 兼容性处理：lodash 数字为 key 时默认创建数组，而非对象
 */
function createObjIfKeyIsNumber(targetFileExportObj, keyChain) {
  const lastKey = keyChain[keyChain.length - 1];
  if (isNumber(lastKey)) {
    const parentKey = keyChain.slice(0, keyChain.length - 1);
    const parent = _.get(targetFileExportObj, parentKey);
    if (!parent) {
      _.set(targetFileExportObj, parentKey, {});
    }
  }
}

function isJSON(extname) {
  return extname === ".json";
}

/**
 * 获取动态 import 的配置
 */
function getDynamicImportConfig(extname) {
  return isJSON(extname)
    ? {
        assert: { type: "json" },
      }
    : {};
}

function isFileEmpty(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size === 0;
}

// const rootSourceDirname = "zh-cn";
// const rootTargetDirname = "zh-tw";
// const hanldeFolderPath = path.join(
//   process.cwd(),
//   `../src/i18n/${rootSourceDirname}`
// );
let unTranslateWordsLog = `# 未翻译词条${os.EOL}`;
traverseFolder(sourceFolderPath, async (sourcePath) => {
  try {
    // console.log(process.cwd(), filePath, path.join(process.cwd(), filePath))

    const relativePath = path.relative(sourceFolderPath, sourcePath);
    const targetPath = path.join(targetFolderPath, relativePath);
    const targetDirname = path.dirname(targetPath);
    const targetExists = fs.existsSync(targetPath);
    const extName = path.extname(targetPath);
    const fileName = path.basename(targetPath);

    // 只处理 js、json、ts 文件
    if (![".js", ".json", ".ts"].includes(extName)) return;
    if (isFileEmpty(sourcePath)) return;

    fs.mkdirSync(targetDirname, { recursive: true });
    if (["index.js", "index.ts"].includes(fileName)) {
      // target 不存在时，复制 source
      if (!targetExists) {
        // 复制 source 的 index.js
        fs.copyFileSync(sourcePath, targetPath);
      }
    } else {
      const sourceFile = require(sourcePath);
      const sourceFileExportObj = isJSON(extName)
        ? sourceFile
        : sourceFile.default;
      let targetFileExportObj = {};
      if (targetExists) {
        const targetFile = require(targetPath);
        targetFileExportObj = isJSON(extName) ? targetFile : targetFile.default;
        // console.log(targetPath, targetFileExportObj)
      }
      unTranslateWordsLog += `${os.EOL}## ${targetPath}${os.EOL}`;

      // @ts-ignore
      traverseObj(sourceFileExportObj, (keyChain, sourceVal) => {
        const targetVal = _.get(targetFileExportObj, keyChain);
        if (!targetVal) {
          createObjIfKeyIsNumber(targetFileExportObj, keyChain);
          // 翻译赋值
          // TODO: 无翻译词条，直翻繁体
        }
        // 新增或更新已有词条
        const translateVal = translateTools[sourceVal];
        if (!translateVal) {
          unTranslateWordsLog += `- (${keyChain.join(".")}) (${sourceVal})${
            os.EOL
          }`;
        }
        _.set(targetFileExportObj, keyChain, translateVal);
      });
      // 创建文件，内容是 targetFileExportObj
      let targetFileExportObjStr =
        `${JSON.stringify(targetFileExportObj, null, 2)}` + os.EOL; // 末尾加空行

      // js、ts 文件做格式处理，json 用标准格式
      if ([".js", ".ts"].includes(extName)) {
        targetFileExportObjStr = targetFileExportObjStr
          // 清除 key 的双引号
          // .replace(/"([^"]+)":/g, '$1:')
          // value 的双引号替换为单引号
          .replace(/\"/g, "\uFFFF") // U+ FFFF
          .replace(/\uFFFF/g, "'");
      }
      const fileContent = isJSON(extName)
        ? targetFileExportObjStr
        : `export default ${targetFileExportObjStr}`;

      fs.writeFileSync(targetPath, fileContent);
    }
  } catch (e) {
    console.log(e);
  }
});

const logDir = path.join(process.cwd(), "/logs");
fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(
  // yyyy-mm-dd
  path.join(logDir, `noTranslatedWords-${new Date().getTime()}.md`),
  unTranslateWordsLog
);
console.log("翻译完成~未翻译词条已记录到 noTranslateWords.md");

// TODO 无翻译词条，直翻繁体

// const data = fs.readFileSync('../src/i18n/zh-cn/tool.js', 'utf8')
// const myModule = require('../src/i18n/zh-cn/tool.js')
// const myObject = import('./common.js').then((module) => {
//   console.log(module)
// })
// const exportedObj = eval(`(function(){${data}; return defaultExport;})()`)
