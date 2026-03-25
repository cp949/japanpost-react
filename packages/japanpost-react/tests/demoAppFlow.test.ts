import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  Fragment,
  StrictMode,
  createElement,
  isValidElement,
  useState,
} from "react";
import {
  formatJapanPostalCode,
  type JapanAddress,
} from "@cp949/japanpost-react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@cp949/japanpost-react", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@cp949/japanpost-react")>();

  return {
    ...actual,
    formatJapanAddressDisplay: vi.fn(actual.formatJapanAddressDisplay),
    formatJapanAddressSearchResultLabel: vi.fn(
      actual.formatJapanAddressSearchResultLabel,
    ),
  };
});

// Intentionally kept in the package test suite for now.
// This demo integration flow depends on the package-local jsdom +
// Testing Library + jest-dom harness, and moving it would require
// expanding the root workspace test setup beyond the current minimal scope.
import App from "../../../apps/demo/src/App";
import * as demoApi from "../../../apps/demo/src/demoApi";
import { JapanPostalAddressField } from "../../../apps/demo/src/components/JapanPostalAddressField";
import {
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
} from "@cp949/japanpost-react";

type MockJsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type MockRequestBody = Record<string, unknown>;

function jsonResponse(status: number, body: unknown): MockJsonResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function parseRequestBody(init?: RequestInit): MockRequestBody {
  return JSON.parse(String(init?.body ?? "{}")) as MockRequestBody;
}

function formatJapanAddressDisplayText(address: JapanAddress): string {
  return address.address.replace(/\s+/g, " ").trim();
}

function formatJapanAddressResultLabel(address: JapanAddress): string {
  return `${formatJapanPostalCode(address.postalCode)} ${formatJapanAddressDisplayText(address)}`;
}

const TEST_INITIAL_ADDRESS: JapanAddress = {
  postalCode: "1020072",
  prefecture: "Tokyo",
  city: "Chiyoda-ku",
  town: "Kioicho",
  address: "Tokyo   Chiyoda-ku \nKioicho",
  provider: "japan-post",
};

const TEST_DEMO_API_BASE_URL = "/demo-api/";
const TEST_DIALOG_ROWS_PER_PAGE = 10;

const TEST_SELECTED_ADDRESS: JapanAddress = {
  postalCode: "1000001",
  prefecture: "Tokyo",
  city: "Chiyoda-ku",
  town: "Chiyoda",
  address: " Tokyo\nChiyoda-ku  Chiyoda ",
  provider: "japan-post",
};

const TEST_OSAKA_ADDRESS: JapanAddress = {
  postalCode: "5300001",
  prefecture: "Osaka",
  city: "Osaka-shi",
  town: "Umeda",
  address: " Osaka  Osaka-shi \nUmeda ",
  provider: "japan-post",
};

const TEST_KYOTO_ADDRESS: JapanAddress = {
  postalCode: "6000000",
  prefecture: "Kyoto",
  city: "Kyoto-shi",
  town: "Shimogyo-ku",
  address: " Kyoto Kyoto-shi Shimogyo-ku ",
  provider: "japan-post",
};

function SelectedAddressHarness() {
  const [selectedAddress, setSelectedAddress] = useState(TEST_INITIAL_ADDRESS);

  return createElement(
    Fragment,
    null,
    createElement(JapanPostalAddressField, {
      demoApiBaseUrl: TEST_DEMO_API_BASE_URL,
      value: selectedAddress,
      onSelectAddress: setSelectedAddress,
    }),
    createElement(
      "div",
      {
        hidden: true,
        "data-testid": "selected-address-snapshot",
      },
      JSON.stringify(selectedAddress),
    ),
  );
}

function containsElementType(node: unknown, targetType: unknown): boolean {
  if (!isValidElement<{ children?: unknown }>(node)) {
    return false;
  }

  if (node.type === targetType) {
    return true;
  }

  const children = node.props?.children;

  if (Array.isArray(children)) {
    return children.some((child) => containsElementType(child, targetType));
  }

  return containsElementType(children, targetType);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("demo app flow", () => {
  it("uses the app-local health adapter on mount", async () => {
    const healthSpy = vi
      .spyOn(demoApi, "readDemoApiHealth")
      .mockResolvedValue({ ok: true });
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(healthSpy).toHaveBeenCalledWith("/minimal-api");
    });
  });

  it("uses the configured runtime API base URL for health and searches", async () => {
    vi.stubEnv("VITE_DEMO_API_BASE_URL", "/custom-demo-api/");

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/custom-demo-api/health") {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url === "/custom-demo-api/q/japanpost/addresszip") {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/custom-demo-api/health");
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const addressField = within(dialog).getByLabelText("Address");

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    expect(formatJapanAddressSearchResultLabel).toHaveBeenCalledWith(
      TEST_SELECTED_ADDRESS,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/custom-demo-api/q/japanpost/addresszip",
        expect.objectContaining({
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            addressQuery: "Tokyo",
            pageNumber: 0,
            rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
          }),
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it("maps unexpected demo fetch failures to network_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Connection reset by peer")),
    );

    const dataSource = demoApi.createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "network_error",
      message: "Network request failed",
    });
  });

  it("renders copy-paste-friendly sample framing and keeps the dialog accessible", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    expect(screen.getByRole("tab", { name: "Dialog" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Embedded" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "useJapanAddressSearch()" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "useJapanPostalCode()" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "useJapanAddress()" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      /dialog/i,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Embedded" }));

    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/embedded/i);
    expect(
      screen.queryByRole("button", { name: "Search address" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Dialog" }));

    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/dialog/i);
  });

  it("renders an inline Embedded search flow that selects an address without opening a dialog", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/addresszip")) {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    fireEvent.click(screen.getByRole("tab", { name: "Embedded" }));

    const panel = screen.getByRole("tabpanel");

    expect(within(panel).queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText("Address"), {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Search" }));

    const resultButton = await within(panel).findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    fireEvent.click(resultButton);

    await waitFor(() => {
      expect(
        within(panel).getByLabelText("Selected postal code"),
      ).toHaveValue("100-0001");
      expect(within(panel).getByLabelText("Selected address")).toHaveValue(
        "Tokyo Chiyoda-ku Chiyoda",
      );
    });

    expect(within(panel).getByText(/postalCode=1000001/)).toBeInTheDocument();
    expect(within(panel).getByText(/prefecture=Tokyo/)).toBeInTheDocument();
    expect(within(panel).getByText(/city=Chiyoda-ku/)).toBeInTheDocument();
    expect(within(panel).getByText(/town=Chiyoda/)).toBeInTheDocument();
    expect(
      within(panel).getByText(/address=\s*Tokyo\s+Chiyoda-ku\s+Chiyoda/i),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/provider=japan-post/)).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows prefix postal-code lookup in the Embedded demo", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        expect(parseRequestBody(init)).toEqual({
          postalCode: "123",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    fireEvent.click(screen.getByRole("tab", { name: "Embedded" }));

    const panel = screen.getByRole("tabpanel");
    const postalCodeField = within(panel).getByLabelText("Postal code");
    const searchButton = within(panel).getByRole("button", { name: "Search" });

    fireEvent.change(postalCodeField, {
      target: {
        value: "123",
      },
    });

    expect(searchButton).toBeEnabled();
    expect(within(panel).getByText("Use 3-7 digits. Hyphen is optional.")).toBeInTheDocument();

    fireEvent.click(searchButton);

    await within(panel).findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });
  });

  it("renders a useJapanAddressSearch() playground that submits structured input inline", async () => {
    let resolveAddressSearch: ((value: MockJsonResponse) => void) | undefined;
    const pendingAddressSearchResponse = new Promise<MockJsonResponse>(
      (resolve) => {
        resolveAddressSearch = resolve;
      },
    );

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/addresszip")) {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Tokyo Station",
          prefName: "Tokyo",
          cityName: "Chiyoda-ku",
          townName: "Chiyoda",
          pageNumber: 2,
          rowsPerPage: 25,
          includeCityDetails: true,
          includePrefectureDetails: false,
        });

        return pendingAddressSearchResponse;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    fireEvent.click(
      screen.getByRole("tab", { name: "useJapanAddressSearch()" }),
    );

    const panel = screen.getByRole("tabpanel");

    fireEvent.change(within(panel).getByLabelText("Address query"), {
      target: {
        value: " Tokyo Station ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Prefecture name"), {
      target: {
        value: " Tokyo ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("City name"), {
      target: {
        value: " Chiyoda-ku ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Town name"), {
      target: {
        value: " Chiyoda ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Page number"), {
      target: {
        value: "2",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Rows per page"), {
      target: {
        value: "25",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Debounce (ms)"), {
      target: {
        value: "0",
      },
    });
    fireEvent.click(within(panel).getByLabelText("Include city details"));

    fireEvent.click(within(panel).getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(within(panel).getByRole("progressbar")).toBeInTheDocument();
    });

    resolveAddressSearch?.(
      jsonResponse(200, {
        elements: [TEST_SELECTED_ADDRESS],
        totalElements: 1,
        pageNumber: 2,
        rowsPerPage: 25,
      }),
    );

    const resultButton = await within(panel).findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    expect(resultButton).toBeInTheDocument();

    fireEvent.click(resultButton);

    expect(within(panel).getByText(/normalized request/i)).toBeInTheDocument();
    expect(within(panel).getByText(/"addressQuery": "Tokyo Station"/)).toBeInTheDocument();
    expect(within(panel).getByText(/"rowsPerPage": 25/)).toBeInTheDocument();
    expect(within(panel).getByLabelText("Selected postal code")).toHaveValue(
      "100-0001",
    );
    expect(within(panel).getByLabelText("Selected address")).toHaveValue(
      "Tokyo Chiyoda-ku Chiyoda",
    );
    expect(within(panel).getByText(/postalCode=1000001/)).toBeInTheDocument();
    expect(within(panel).getByText(/provider=japan-post/)).toBeInTheDocument();
  });

  it("renders a useJapanPostalCode() playground that submits structured input inline", async () => {
    let resolvePostalCodeSearch: ((value: MockJsonResponse) => void) | undefined;
    const pendingPostalCodeSearchResponse = new Promise<MockJsonResponse>(
      (resolve) => {
        resolvePostalCodeSearch = resolve;
      },
    );

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        expect(parseRequestBody(init)).toEqual({
          postalCode: "1000001",
          pageNumber: 1,
          rowsPerPage: 25,
          includeParenthesesTown: true,
        });

        return pendingPostalCodeSearchResponse;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    fireEvent.click(
      screen.getByRole("tab", { name: "useJapanPostalCode()" }),
    );

    const panel = screen.getByRole("tabpanel");

    fireEvent.change(within(panel).getByLabelText("Postal code"), {
      target: {
        value: "100-0001",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Page number"), {
      target: {
        value: "1",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Rows per page"), {
      target: {
        value: "25",
      },
    });
    fireEvent.click(within(panel).getByLabelText("Include parentheses town"));

    fireEvent.click(within(panel).getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(within(panel).getByRole("progressbar")).toBeInTheDocument();
    });

    resolvePostalCodeSearch?.(
      jsonResponse(200, {
        elements: [TEST_SELECTED_ADDRESS],
        totalElements: 1,
        pageNumber: 1,
        rowsPerPage: 25,
      }),
    );

    const resultButton = await within(panel).findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    expect(resultButton).toBeInTheDocument();

    fireEvent.click(resultButton);

    expect(within(panel).getByText(/normalized request/i)).toBeInTheDocument();
    expect(
      within(panel).getByText(/"postalCode": "1000001"/),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(/"includeParenthesesTown": true/),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText("Selected postal code")).toHaveValue(
      "100-0001",
    );
    expect(within(panel).getByLabelText("Selected address")).toHaveValue(
      "Tokyo Chiyoda-ku Chiyoda",
    );
    expect(within(panel).getByText(/postalCode=1000001/)).toBeInTheDocument();
    expect(within(panel).getByText(/provider=japan-post/)).toBeInTheDocument();
  });

  it("renders a useJapanAddress() playground that switches between postal-code and address-query modes", async () => {
    let resolvePostalCodeSearch: ((value: MockJsonResponse) => void) | undefined;
    const pendingPostalCodeSearchResponse = new Promise<MockJsonResponse>(
      (resolve) => {
        resolvePostalCodeSearch = resolve;
      },
    );
    let resolveAddressSearch: ((value: MockJsonResponse) => void) | undefined;
    const pendingAddressSearchResponse = new Promise<MockJsonResponse>(
      (resolve) => {
        resolveAddressSearch = resolve;
      },
    );

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        expect(parseRequestBody(init)).toEqual({
          postalCode: "1000001",
          pageNumber: 1,
          rowsPerPage: 25,
          includeParenthesesTown: true,
        });

        return pendingPostalCodeSearchResponse;
      }

      if (url.includes("/q/japanpost/addresszip")) {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Osaka Station",
          prefName: "Osaka",
          cityName: "Osaka-shi",
          townName: "Umeda",
          pageNumber: 0,
          rowsPerPage: 15,
          includeCityDetails: true,
          includePrefectureDetails: false,
        });

        return pendingAddressSearchResponse;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    fireEvent.click(screen.getByRole("tab", { name: "useJapanAddress()" }));

    const panel = screen.getByRole("tabpanel");

    expect(within(panel).getByText(/unified hook state/i)).toBeInTheDocument();

    fireEvent.click(
      within(panel).getByRole("radio", { name: "Postal code mode" }),
    );

    fireEvent.change(within(panel).getByLabelText("Postal code"), {
      target: {
        value: "100-0001",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Page number"), {
      target: {
        value: "1",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Rows per page"), {
      target: {
        value: "25",
      },
    });
    fireEvent.click(within(panel).getByLabelText("Include parentheses town"));

    fireEvent.click(within(panel).getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(within(panel).getByRole("progressbar")).toBeInTheDocument();
    });

    resolvePostalCodeSearch?.(
      jsonResponse(200, {
        elements: [TEST_SELECTED_ADDRESS],
        totalElements: 1,
        pageNumber: 1,
        rowsPerPage: 25,
      }),
    );

    const postalCodeResultButton = await within(panel).findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    expect(postalCodeResultButton).toBeInTheDocument();

    fireEvent.click(postalCodeResultButton);

    expect(
      within(panel).getByText(/"postalCode": "1000001"/),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/"mode": "postalCode"/)).toBeInTheDocument();
    expect(within(panel).getByLabelText("Selected postal code")).toHaveValue(
      "100-0001",
    );
    expect(within(panel).getByText(/postalCode=1000001/)).toBeInTheDocument();
    expect(within(panel).getByText(/provider=japan-post/)).toBeInTheDocument();

    fireEvent.click(
      within(panel).getByRole("radio", { name: "Address query mode" }),
    );

    fireEvent.change(within(panel).getByLabelText("Address query"), {
      target: {
        value: " Osaka Station ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Prefecture name"), {
      target: {
        value: " Osaka ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("City name"), {
      target: {
        value: " Osaka-shi ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Town name"), {
      target: {
        value: " Umeda ",
      },
    });
    fireEvent.change(within(panel).getByLabelText("Rows per page"), {
      target: {
        value: "15",
      },
    });
    fireEvent.click(within(panel).getByLabelText("Include city details"));

    fireEvent.click(within(panel).getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(within(panel).getByRole("progressbar")).toBeInTheDocument();
    });

    resolveAddressSearch?.(
      jsonResponse(200, {
        elements: [TEST_OSAKA_ADDRESS],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: 15,
      }),
    );

    const addressQueryResultButton = await within(panel).findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_OSAKA_ADDRESS),
    });

    expect(addressQueryResultButton).toBeInTheDocument();

    fireEvent.click(addressQueryResultButton);

    expect(
      within(panel).getByText(/"addressQuery": "Osaka Station"/),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(/"mode": "addressQuery"/),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText("Selected postal code")).toHaveValue(
      "530-0001",
    );
    expect(within(panel).getByLabelText("Selected address")).toHaveValue(
      "Osaka Osaka-shi Umeda",
    );
    expect(within(panel).getByText(/postalCode=5300001/)).toBeInTheDocument();
    expect(within(panel).getByText(/provider=japan-post/)).toBeInTheDocument();
  });

  it("closes the search dialog when Escape is pressed", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });

    fireEvent.keyDown(dialog, {
      code: "Escape",
      key: "Escape",
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search address" }),
      ).not.toBeInTheDocument();
    });
  });

  it("formats a selected JapanAddress as a readable one-line string", () => {
    expect(
      formatJapanAddressDisplay({
        postalCode: "1020072",
        prefecture: "Tokyo",
        city: "Chiyoda-ku",
        town: "Kioicho",
        address: " Tokyo   Chiyoda-ku \nKioicho ",
        provider: "japan-post",
      }),
    ).toBe("Tokyo Chiyoda-ku Kioicho");
  });

  it("shows read-only address fields and opens the search dialog", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
    const dialogPanel = screen.getByRole("tabpanel");

    expect(within(dialogPanel).getByLabelText("Postal code")).toHaveAttribute(
      "readonly",
    );
    expect(within(dialogPanel).getByLabelText("Address")).toHaveAttribute(
      "readonly",
    );
    expect(within(dialogPanel).getByLabelText("Address")).toHaveValue(
      "Tokyo Chiyoda-ku Kioicho",
    );
    expect(
      within(dialogPanel).getByRole("button", { name: "Search address" }),
    ).toBeEnabled();

    fireEvent.click(
      within(dialogPanel).getByRole("button", { name: "Search address" }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Search address" }),
      ).toBeInTheDocument();
    });
  });

  it("updates the visible address fields in App after selecting a result", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/addresszip")) {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const addressField = within(dialog).getByLabelText("Address");

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    const resultButton = await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    fireEvent.click(resultButton);

    await waitFor(() => {
      const dialogPanel = screen.getByRole("tabpanel");

      expect(within(dialogPanel).getByLabelText("Postal code")).toHaveValue(
        "100-0001",
      );
      expect(within(dialogPanel).getByLabelText("Address")).toHaveValue(
        "Tokyo Chiyoda-ku Chiyoda",
      );
    });

    expect(formatJapanAddressDisplay).toHaveBeenCalledWith(TEST_SELECTED_ADDRESS);
  });

  it("closes the dialog with an explicit close button", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search address" }),
      ).not.toBeInTheDocument();
    });
  });

  it("filters postal code input and clears address while typing it", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const postalCodeField = within(dialog).getByLabelText("Postal code");
    const addressField = within(dialog).getByLabelText("Address");
    const searchButton = within(dialog).getByRole("button", { name: "Search" });

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });

    expect(addressField).toHaveValue("Tokyo");
    expect(postalCodeField).toHaveValue("");
    expect(searchButton).toBeEnabled();

    fireEvent.change(postalCodeField, {
      target: {
        value: "12ab-34한글!567",
      },
    });

    expect(postalCodeField).toHaveValue("12-34567");
    expect(addressField).toHaveValue("");
    expect(searchButton).toBeEnabled();

    expect(
      within(dialog).getByText("Use 3-7 digits. Hyphen is optional."),
    ).toBeInTheDocument();

    fireEvent.change(postalCodeField, {
      target: {
        value: "123",
      },
    });

    expect(searchButton).toBeEnabled();

    fireEvent.change(postalCodeField, {
      target: {
        value: "1234567",
      },
    });

    expect(searchButton).toBeEnabled();

    fireEvent.change(postalCodeField, {
      target: {
        value: "1234-567",
      },
    });

    expect(searchButton).toBeEnabled();
  });

  it("routes postal code and address searches to the correct endpoints and shows request states", async () => {
    const emptyPage = {
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
    };
    let resolveSearchcode: ((value: MockJsonResponse) => void) | undefined;
    const pendingSearchcodeResponse = new Promise<MockJsonResponse>(
      (resolve) => {
        resolveSearchcode = resolve;
      },
    );
    let searchcodeCalls = 0;

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        searchcodeCalls += 1;

        expect(parseRequestBody(init)).toEqual({
          postalCode: "1234567",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        if (searchcodeCalls === 1) {
          return pendingSearchcodeResponse;
        }

        return jsonResponse(200, emptyPage);
      }

      if (url.includes("/q/japanpost/addresszip")) {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(500, {
          message: "Request failed with status 500",
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const postalCodeField = within(dialog).getByLabelText("Postal code");
    const addressField = within(dialog).getByLabelText("Address");
    const searchButton = within(dialog).getByRole("button", { name: "Search" });

    fireEvent.change(postalCodeField, {
      target: {
        value: "1234567",
      },
    });
    fireEvent.click(searchButton);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    resolveSearchcode?.(jsonResponse(200, emptyPage));

    expect(await screen.findByText("No results found.")).toBeInTheDocument();

    fireEvent.change(postalCodeField, {
      target: {
        value: "123-4567",
      },
    });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(searchcodeCalls).toBe(2);
    });

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });

    expect(postalCodeField).toHaveValue("");
    expect(searchButton).toBeEnabled();

    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });
  });

  it("allows prefix postal-code lookup in the dialog demo", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/searchcode")) {
        expect(parseRequestBody(init)).toEqual({
          postalCode: "123",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const postalCodeField = within(dialog).getByLabelText("Postal code");
    const searchButton = within(dialog).getByRole("button", { name: "Search" });

    fireEvent.change(postalCodeField, {
      target: {
        value: "123",
      },
    });

    expect(searchButton).toBeEnabled();
    expect(
      within(dialog).getByText("Use 3-7 digits. Hyphen is optional."),
    ).toBeInTheDocument();

    fireEvent.click(searchButton);

    await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });
  });

  it("renders result rows with both postal code and address text for copy-paste-friendly selection", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/addresszip")) {
        expect(parseRequestBody(init)).toEqual({
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });

        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const addressField = within(dialog).getByLabelText("Address");

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    const resultButton = await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    expect(resultButton).toHaveTextContent("100-0001");
    expect(resultButton).toHaveTextContent("Tokyo Chiyoda-ku Chiyoda");
  });

  it("shows pagination for multi-page dialog results and re-queries the active search on page change", async () => {
    const searchBodies: MockRequestBody[] = [];

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/addresszip")) {
        const body = parseRequestBody(init);

        searchBodies.push(body);

        if (body.addressQuery === "Tokyo" && body.pageNumber === 0) {
          return jsonResponse(200, {
            elements: [TEST_SELECTED_ADDRESS],
            totalElements: 11,
            pageNumber: 0,
            rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
          });
        }

        if (body.addressQuery === "Tokyo" && body.pageNumber === 1) {
          return jsonResponse(200, {
            elements: [TEST_OSAKA_ADDRESS],
            totalElements: 11,
            pageNumber: 1,
            rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
          });
        }

        if (body.addressQuery === "Kyoto" && body.pageNumber === 0) {
          return jsonResponse(200, {
            elements: [TEST_KYOTO_ADDRESS],
            totalElements: 1,
            pageNumber: 0,
            rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
          });
        }

        throw new Error(`Unexpected address query: ${JSON.stringify(body)}`);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const addressField = within(dialog).getByLabelText("Address");

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    const goToPageTwoButton = within(dialog).getByRole("button", {
      name: /go to page 2/i,
    });

    fireEvent.click(goToPageTwoButton);

    await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_OSAKA_ADDRESS),
    });

    fireEvent.change(addressField, {
      target: {
        value: "Kyoto",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_KYOTO_ADDRESS),
    });

    expect(searchBodies).toEqual([
      {
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
      },
      {
        addressQuery: "Tokyo",
        pageNumber: 1,
        rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
      },
      {
        addressQuery: "Kyoto",
        pageNumber: 0,
        rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
      },
    ]);
  });

  it("clears stale search UI and ignores an outdated in-flight response after the query changes", async () => {
    let resolveOsakaSearch: ((value: MockJsonResponse) => void) | undefined;
    const pendingOsakaResponse = new Promise<MockJsonResponse>((resolve) => {
      resolveOsakaSearch = resolve;
    });

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return jsonResponse(200, {
          ok: true,
        });
      }

      if (url.includes("/q/japanpost/addresszip")) {
        const body = parseRequestBody(init);

        if (body.addressQuery === "Tokyo") {
          return jsonResponse(200, {
            elements: [TEST_SELECTED_ADDRESS],
            totalElements: 1,
            pageNumber: 0,
            rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
          });
        }

        if (body.addressQuery === "Osaka") {
          return pendingOsakaResponse;
        }

        throw new Error(`Unexpected address query: ${body.addressQuery}`);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const addressField = within(dialog).getByLabelText("Address");

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    const tokyoResultButton = await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    fireEvent.change(addressField, {
      target: {
        value: "Osaka",
      },
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
        }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    fireEvent.change(addressField, {
      target: {
        value: "Kyoto",
      },
    });

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: formatJapanAddressResultLabel(TEST_OSAKA_ADDRESS),
        }),
      ).not.toBeInTheDocument();
    });

    resolveOsakaSearch?.(
      jsonResponse(200, {
        elements: [TEST_OSAKA_ADDRESS],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: formatJapanAddressResultLabel(TEST_OSAKA_ADDRESS),
        }),
      ).not.toBeInTheDocument();
    });

    expect(tokyoResultButton).not.toBeInTheDocument();
  });

  it("preserves the parent-selected address in a test-only harness", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/q/japanpost/addresszip")) {
        return jsonResponse(200, {
          elements: [TEST_SELECTED_ADDRESS],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: TEST_DIALOG_ROWS_PER_PAGE,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(SelectedAddressHarness));

    fireEvent.click(screen.getByRole("button", { name: "Search address" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Search address",
    });
    const addressField = within(dialog).getByLabelText("Address");

    fireEvent.change(addressField, {
      target: {
        value: "Tokyo",
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));

    const resultButton = await screen.findByRole("button", {
      name: formatJapanAddressResultLabel(TEST_SELECTED_ADDRESS),
    });

    fireEvent.click(resultButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Postal code")).toHaveValue("100-0001");
      expect(screen.getByLabelText("Address")).toHaveValue(
        "Tokyo Chiyoda-ku Chiyoda",
      );
    });

    const snapshot = screen.getByTestId("selected-address-snapshot");

    expect(JSON.parse(snapshot.textContent ?? "{}")).toEqual(
      TEST_SELECTED_ADDRESS,
    );
  });

  it("mounts the app from the entrypoint root element", async () => {
    document.body.innerHTML = '<div id="root"></div>';

    const renderMock = vi.fn();
    const createRootMock = vi.fn(() => ({
      render: renderMock,
    }));

    vi.doMock("react-dom/client", () => ({
      default: {
        createRoot: createRootMock,
      },
    }));

    await import("../../../apps/demo/src/main");

    const rootElement = document.getElementById("root");

    expect(rootElement).toBeInstanceOf(HTMLElement);
    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);

    const renderedTree = renderMock.mock.calls[0]?.[0] as {
      type?: unknown;
      props?: {
        children?: {
          type?: unknown;
        };
      };
    };

    expect(renderedTree?.type).toBe(StrictMode);
    expect(containsElementType(renderedTree, App)).toBe(true);
  });
});
