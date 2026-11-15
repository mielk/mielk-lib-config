// Vitest configuration of this package: its own shared configuration, loaded from source (Vite resolves the .js import to the .ts file).
import { mielkVitest } from './src/vitest.js';

export default mielkVitest({ name: 'mielk-lib-config' });
