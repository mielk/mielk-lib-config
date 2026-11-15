// ESLint configuration of this package: its own shared configuration, loaded from source (Node.js strips the types),
// so lint does not depend on a build. The sample library in fixtures/ is linted by the integration test.
import { mielkEslint } from './src/eslint.ts';

export default mielkEslint({
    rootDir: import.meta.dirname,
    ignores: ['fixtures/'],
    allowEnv: ['scripts/**/*.ts', 'src/bin/**/*.ts'],
});
