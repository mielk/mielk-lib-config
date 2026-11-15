// Build step of this package: copies the JSON configurations from config/ to dist/config/, the files behind the entry
// points ./tsconfig.json, ./tsconfig.build.json and ./prettier. Node.js runs this TypeScript file directly by
// stripping its types, so the file uses only erasable syntax and imports nothing but Node.js modules.
import { cpSync } from 'node:fs';

cpSync('config', 'dist/config', { recursive: true });
