import type {
  JapanAddress,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  Page,
} from "../../packages/japanpost-react/src/core/types";

import type { AddressAdapter } from "../../apps/minimal-api/src/japanPostAdapter";
import { describe, expectTypeOf, it } from "vitest";

describe("minimal api shared contracts", () => {
  it("keeps adapter request and response types aligned with the package contract", () => {
    expectTypeOf<Parameters<AddressAdapter["searchcode"]>[0]>().toEqualTypeOf<
      JapanPostSearchcodeRequest
    >();
    expectTypeOf<Parameters<AddressAdapter["addresszip"]>[0]>().toEqualTypeOf<
      JapanPostAddresszipRequest
    >();
    expectTypeOf<
      Awaited<ReturnType<AddressAdapter["searchcode"]>>
    >().toEqualTypeOf<Page<JapanAddress>>();
    expectTypeOf<
      Awaited<ReturnType<AddressAdapter["addresszip"]>>
    >().toEqualTypeOf<Page<JapanAddress>>();
  });
});
