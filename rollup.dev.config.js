import typescript from 'rollup-plugin-typescript';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonJs from 'rollup-plugin-commonjs';

import tsc from 'typescript';

export default {
  plugins: [
    typescript({ typescript: tsc }),
    nodeResolve({ jsnext: true, main: true, browser: true }),
    commonJs()
  ]
};
