import path from "node:path";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "unilink-release",
      apply: "build",
      enforce: "post",
      generateBundle(_, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset" || typeof index.source !== "string") {
          this.error("Unable to identify the UniLink web release.");
          return;
        }
        // Vite's HTML includes the content-hashed JS and CSS entry points.
        const hash = createHash("sha256").update(index.source);
        for (const file of ["manifest.webmanifest", "sw.js", "offline.html", "icons/unilink-180.png", "icons/unilink-192.png", "icons/unilink-512.png"]) {
          hash.update(readFileSync(path.join(__dirname, "public", file)));
        }
        const version = hash.digest("hex");
        index.source = index.source.replace("</head>", '<meta name="unilink-release" content="' + version + '"></head>');
        this.emitFile({ type: "asset", fileName: "release.json", source: JSON.stringify({ version }) });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:22000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    target: ["chrome67", "safari14", "firefox78", "edge88"],
  },
});
