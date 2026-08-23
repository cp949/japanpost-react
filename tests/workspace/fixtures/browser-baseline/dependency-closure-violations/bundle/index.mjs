import value from "runtime-dep/subpath";
export { optionalValue } from "optional-dep/feature";
export * from "@scope/runtime-dep/feature";
import "@scope/undeclared/subpath";
import("dev-only/tool");
import(`@scope/dev-only/tool`);
import "@scope";
const requested = "runtime-dep";
import(requested);
import("runtime-dep/options", { with: { type: "json" } });

void value;
