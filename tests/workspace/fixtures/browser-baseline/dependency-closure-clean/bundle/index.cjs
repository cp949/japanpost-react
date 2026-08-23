/* eslint-disable @typescript-eslint/no-require-imports -- CJS require 수집 계약을 검증하는 fixture다. */
const selfValue = require("@fixture/dependency-closure-clean/cjs");
const peerValue = require("peer-dep/cjs");
const scopedPeerValue = require(`@scope/peer-dep/cjs`);
require("./local.cjs");

function loadWith(require, request) {
  return require(request);
}

loadWith(() => undefined, "runtime-dep");
void selfValue;
void peerValue;
void scopedPeerValue;
