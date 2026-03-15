import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import trTR from "antd/locale/tr_TR";
import "./style.css";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 12,
    colorSuccess: "#059669",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
    colorTextHeading: "#0f172a",
    colorText: "#334155",
  },
  components: {
    Card: {
      headerBg: "transparent",
      headerFontSize: 16,
      headerFontWeight: 600,
      borderRadiusLG: 16,
    },
    Button: {
      borderRadius: 12,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 12,
    },
    Select: {
      borderRadius: 12,
    },
    Table: {
      borderRadius: 12,
    },
  },
};

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider locale={trTR} theme={theme}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  </React.StrictMode>
);