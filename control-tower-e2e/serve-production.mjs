import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const nodeCommand = process.execPath;
const viteCli = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");

function runToCompletion(argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeCommand, argumentsList, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${nodeCommand} ${argumentsList.join(" ")} exited with ${code}`));
    });
  });
}

await runToCompletion([viteCli, "build"]);

const preview = spawn(
  nodeCommand,
  [viteCli, "preview", "--host", "127.0.0.1", "--port", "43175", "--strictPort"],
  {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => preview.kill(signal));
}

preview.once("error", (error) => {
  throw error;
});

const exitCode = await new Promise((resolve) => preview.once("exit", resolve));
process.exit(typeof exitCode === "number" ? exitCode : 0);
