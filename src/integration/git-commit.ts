import { execFileSync } from "node:child_process";

// Build-time short commit hash, baked into the dashboard footer so a deploy can
// be visually confirmed. Returns "" outside a git checkout, in which case the
// footer renders nothing extra.
export function resolveCommitId(cwd: string = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}
