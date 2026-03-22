import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Mount the React application
ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Hide loading screen after React mounts
document.body.classList.add("loaded");
