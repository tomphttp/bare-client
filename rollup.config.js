import babel from '@rollup/plugin-babel';
import inject from '@rollup/plugin-inject';
import { resolve } from 'path';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

/**
 * @type {import('rollup').RollupOptions[]}
 */
const configs = [
	['esm', 'src/BareClient.ts', 'named', false, [false]], // import
	['umd', 'src/index.ts', 'default', true, [true, false]], // require, minify for browser
]
	.map(([format, input, exports, cjs, modes]) =>
		modes.map((minify) => ({
			input,
			output: {
				file: `dist/BareClient.${format}${minify ? '.min' : ''}${
					cjs ? '.cjs' : '.js'
				}`,
				format,
				name: 'BareClient',
				sourcemap: true,
				exports,
			},
			plugins: [
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
				babel({ babelHelpers: 'bundled', extensions: ['.ts'] }),
				minify && terser(),
				sourcemaps(),
			],
		}))
	)
	.flat(1);

export default configs;
