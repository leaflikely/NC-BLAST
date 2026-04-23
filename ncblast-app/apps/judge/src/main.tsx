import React from "react";
import ReactDOM from "react-dom/client";
import { BeyJudgeApp } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <ErrorBoundary variant="judge">
      <BeyJudgeApp />
    </ErrorBoundary>,
  );
}
