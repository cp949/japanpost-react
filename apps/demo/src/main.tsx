import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { theme } from "./theme";

// 데모 애플리케이션 전체를 렌더링할 실제 DOM 루트 노드다.
// Vite 템플릿의 `index.html` 에서 같은 id를 가진 div를 미리 준비해 둔다.
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

// MUI 전역 테마와 기본 CSS 리셋을 루트에서 감싸 두면
// 하위 예제 컴포넌트들이 동일한 디자인 토큰과 기본 스타일을 공유할 수 있다.
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
