import typescript from 'rollup-plugin-typescript';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonJs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-js';

import tsc from 'typescript';

export default {
  plugins: [
    typescript({ typescript: tsc }),
    nodeResolve({ jsnext: true, main: true, browser: true }),
    commonJs(),
    /*uglify({
      comments: function(node, comment) {
        if (comment.type == "comment2") {
          // multiline comment 
          return /@preserve|@license|@cc_on/i.test(comment.value);
        }
      }
    }, minify)*/
  ],
  format: 'iife'
};
