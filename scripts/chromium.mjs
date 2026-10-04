// Use the machine's preinstalled Chromium when the pinned Playwright build is absent.
import { existsSync } from "node:fs";
const local = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
export const executablePath = existsSync(local) ? local : undefined;
