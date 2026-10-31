import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

for (const name of ["HTTP_PROXY", "HTTPS_PROXY"]) {
  const value = process.env[name];
  if (value && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    process.env[name] = `http://${value}`;
  }
}

if (process.allowedNodeEnvironmentFlags.has("--use-env-proxy")) {
  const nodeOptions = (process.env.NODE_OPTIONS ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (!nodeOptions.includes("--use-env-proxy")) {
    process.env.NODE_OPTIONS = [...nodeOptions, "--use-env-proxy"].join(" ");
  }
}
const nextCli = require.resolve("next/dist/bin/next");
const server = spawn(
  process.execPath,
  [nextCli, "dev", "--webpack", ...process.argv.slice(2)],
  { env: process.env, stdio: "inherit" }
);

server.on("error", (error) => {
  console.error("Failed to start the Next.js development server:", error.message);
  process.exitCode = 1;
});

server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
