/* eslint-disable @typescript-eslint/no-require-imports -- CJS require 위반 판정을 검증하는 fixture다. */
const fsPromises = require("fs/promises");
const fsModule = require("node:fs");
const runtimeValue = require("runtime-dep");
const optionalValue = require(`optional-dep`);
const requested = "runtime-dep";
require(requested);
require();
require("runtime-dep", "extra");
const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];
const unicode = [require(""), require("𐀀")];

void fsPromises;
void fsModule;
void runtimeValue;
void optionalValue;
void s;
void unicode;
