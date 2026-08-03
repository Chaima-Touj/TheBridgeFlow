// One-off: strips the hardcoded /v<timestamp>/ version segment from every
// URL in cloudinary-urls.json, so the generated videoUrls.js always resolves
// to Cloudinary's current asset for a given public_id — no regeneration
// needed after overwriting a video with the same public_id in the Cloudinary
// dashboard. Usage: node thebridgeflow-front/scripts/strip-cloudinary-versions.js
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPPING_PATH = path.join(__dirname, "cloudinary-urls.json");

const VERSION_SEGMENT = /\/upload\/v\d+\//;

const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
let changed = 0;

const stripped = Object.fromEntries(
  Object.entries(mapping).map(([localPath, url]) => {
    if (VERSION_SEGMENT.test(url)) {
      changed++;
      return [localPath, url.replace(VERSION_SEGMENT, "/upload/")];
    }
    return [localPath, url];
  })
);

fs.writeFileSync(MAPPING_PATH, JSON.stringify(stripped, null, 2) + "\n");
console.log(`${changed}/${Object.keys(mapping).length} URLs mises à jour (version retirée) dans ${MAPPING_PATH}`);
