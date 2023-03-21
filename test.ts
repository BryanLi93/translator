// @ts-nocheck
import path from "path";
import { traverseObj } from "./main.ts";
import _ from "lodash";

// TEST
const sourceFileExportObj = (
  await import(path.join(process.cwd(), "./zh-cn/back/CommissionServer.js"))
).default;
const targetFileExportObj = (
  await import(path.join(process.cwd(), "./zh-tw/back/CommissionServer.js"))
).default;
traverseObj(sourceFileExportObj, async (keyChain, sourceVal) => {
  const targetVal = _.get(targetFileExportObj, keyChain);
  console.log(`${keyChain}-------------`);
  console.log("sourceVal", sourceVal);
  console.log("targetVal", targetVal);
});
