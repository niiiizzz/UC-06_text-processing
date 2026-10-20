import { defineConfig, mergeConfig } from "vite";
import config from "./vite.config";

const routes = ["/api", "/health", "/auth", "/tools", "/subscription", "/runs", "/billing"];

export default mergeConfig(
  config,
  defineConfig({
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: Object.fromEntries(
        routes.map((route) => [
          route,
          { target: "http://127.0.0.1:8001", changeOrigin: true },
        ])
      ),
    },
  })
);
