import { resolve } from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import nodeResolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

const snapshot = Object.fromEntries(
	['fetch', 'Request', 'Response', 'WebSocket', 'XMLHttpRequest'].map(name => [
		resolve('src/snapshot.ts'),
		name,
	])
);

export default [
	// ES Modules
	{
		input: 'src/index.ts',
		output: {
			file: 'dist/BareClient.es.js',
			format: 'es',
			exports: 'default',
		},
		plugins: [
			inject({
				...snapshot,
			}),
			nodeResolve({ browser: true }),
			commonjs(),
			typescript(),
			babel({ babelHelpers: 'bundled', extensions: ['.ts'] }),
		],
	},

	// UMD
	{
		input: 'src/index.ts',
		output: {
			file: 'dist/BareClient.umd.min.js',
			format: 'umd',
			exports: 'default',
			name: 'BareClient',
			indent: false,
		},
		plugins: [
			inject({
				...snapshot,
			}),
			nodeResolve({ browser: true }),
			commonjs(),
			typescript(),
			babel({
				babelHelpers: 'bundled',
				extensions: ['.ts'],
				exclude: 'node_modules/**',
			}),
			terser(),
		],
	},
];
