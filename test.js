const path = require("path");
const fsPromise = require("fs/promises");
const hooksTrace = require("./src/index");
const basename = "";

function isJsxOrTsxfile(dir) {
    return /((\.js)|(\.jsx)|(\.ts)|(\.tsx))$/.test(dir);
}

async function readAlldir(basename) {
    try {
        const dirs = await fsPromise.readdir(basename);
        for (const dir of dirs) {
            const stat = await fsPromise.lstat(path.join(basename, dir));
            const dirName = path.join(basename, dir);

            if (!stat.isFile()) {
                await readAlldir(dirName);
            } else {
                if (isJsxOrTsxfile(dirName)) {
                    try {
                        hooksTrace({ filePath: dirName });
                    } catch (error) {
                        console.log(dirName);
                    }
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
}
async function handleAllFile() {
    await readAlldir(basename);
}

handleAllFile();
