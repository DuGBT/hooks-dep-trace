import fs from "fs";
import babelParser from "@babel/parser";

const fileContent = fs.readFileSync("_source_code/source-code.js").toString();
const ast = babelParser.parse(fileContent, {
	sourceType: "module",
	plugins: ["jsx"],
});
