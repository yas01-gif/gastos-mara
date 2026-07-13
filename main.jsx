import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Archivo de configuración de Vite embebido para simplificar:
// crea también vite.config.js con el contenido que está en la guía si Vercel lo pide.
