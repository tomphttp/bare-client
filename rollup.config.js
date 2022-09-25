import inject from '@rollup/plugin-inject';
import { fileURLToPath } from 'node:url';
import sourcemaps from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';

/**
 * @typedef {import('rollup').OutputOptions} OutputOptions
 * @typedef {import('rollup').RollupOptions} RollupOptions
 */

/**
 * @returns {RollupOptions['plugins']!}
 */
const commonPlugins = () => [
	typescript(),
	inject(
		Object.fromEntries(
			['fetch', 'Request', 'Response', 'WebSocket', 'XMLHttpRequest'].map(
				(name) => [
					name,
					[fileURLToPath(new URL('./src/snapshot.ts', import.meta.url)), name],
				]
			)
		)
	),
	sourcemaps(),
];

/**
 * @type {RollupOptions[]}
 */
const configs = [
	// import
	{
		input: 'src/BareClient.ts',
		output: {
			file: `dist/BareClient.js`,
			format: 'esm',
			name: 'BareClient',
			sourcemap: true,
			exports: 'named',
		},
		plugins: commonPlugins(),
	},
	// require
	{
		input: 'src/index.ts',
		output: {
			file: `dist/BareClient.cjs`,
			format: 'umd',
			name: 'createBareClient',
			sourcemap: true,
			exports: 'default',
		},
		plugins: commonPlugins(),
	},
];

export default configs;
