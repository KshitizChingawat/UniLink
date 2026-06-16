import { appConfig } from "./config.js";
const MAX_SINGLE_FILE_SIZE = appConfig.maxFileSizeBytes;
const PRO_FILE_SIZE_LIMIT = Math.max(10 * 1024 * 1024 * 1024, MAX_SINGLE_FILE_SIZE);

console.log("MAX_SINGLE_FILE_SIZE:", MAX_SINGLE_FILE_SIZE);
console.log("PRO_FILE_SIZE_LIMIT:", PRO_FILE_SIZE_LIMIT);
