import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import { Dashboard } from "./pages/Dashboard";
import { DatabasePage } from "./pages/DatabasePage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider>
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/database/:name" element={<DatabasePage />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>
);
