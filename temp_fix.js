import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/lib/services/gameService.ts');
const content = fs.readFileSync(filePath, 'utf8');
const fixed = content.replace('export function subscribeToGame Wedges', 'export function subscribeToGameWedges');
fs.writeFileSync(filePath, fixed, 'utf8');
console.log('Fix applied successfully.');