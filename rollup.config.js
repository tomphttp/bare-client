import inject from '@rollup/plugin-inject';
import { resolve } from 'path';
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
			[
				'global',
				'fetch',
				'Request',
				'Response',
				'WebSocket',
				'XMLHttpRequest',
			].map((name) => [name, [resolve('src/snapshot.ts'), name]])
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
	// require, minify for browser
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
