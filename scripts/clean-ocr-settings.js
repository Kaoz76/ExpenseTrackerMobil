import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(__dirname, '../node_modules/@carviz/capacitor-ocr/android/settings.gradle');

if (fs.existsSync(targetFile)) {
    try {
        fs.unlinkSync(targetFile);
        console.log(`Successfully removed unused settings.gradle from @carviz/capacitor-ocr plugin to prevent Gradle project collision.`);
    } catch (err) {
        console.error(`Failed to remove settings.gradle:`, err.message);
    }
} else {
    console.log('No settings.gradle found in @carviz/capacitor-ocr plugin (already clean).');
}
