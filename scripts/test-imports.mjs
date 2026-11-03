import { spawnSync } from "node:child_process";

// Windows commonly provides the Python launcher without a python3 executable.
const candidates =
  process.platform === "win32"
    ? ["py", "python3", "python"]
    : ["python3", "python"];
for (const command of candidates) {
  const result = spawnSync(
    command,
    ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"],
    { stdio: "inherit" },
  );
  if (result.error?.code === "ENOENT") continue;
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
console.error("Python 3 is required to run the WXR fixture tests.");
process.exit(1);
