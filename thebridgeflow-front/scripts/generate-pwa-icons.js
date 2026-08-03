/**
 * Génère les icônes PWA 192×192 et 512×512 à partir du favicon existant.
 * Usage : node scripts/generate-pwa-icons.js
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import process from "process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const sizes = [192, 512];
const input = join(publicDir, "favicon.png");

if (!existsSync(input)) {
  console.error("❌ favicon.png introuvable dans thebridgeflow-front/public/");
  process.exit(1);
}

for (const size of sizes) {
  const output = join(publicDir, `pwa-${size}x${size}.png`);
  sharp(input)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(output)
    .then(() => console.log(`✅ ${output} généré (${size}×${size})`))
    .catch((err) => {
      console.error(`❌ Erreur génération ${size}x${size} :`, err);
      process.exit(1);
    });
}

