#!/usr/bin/env node
const program = require("commander");
const { main } = require("../src/index");
program
    .option("-path, --file-path <source>", "source file path")
    .option("-console, --log-in-console", "log result in console")
    .option("--save", "save result")
    .parse(process.argv);

const params = program.opts();
main(params);
