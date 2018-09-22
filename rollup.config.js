import babel from 'rollup-plugin-babel';
import string from 'rollup-plugin-string';

import pkg from './package.json';

export default {
  input   : 'src/js/index.js',
  output  : {
    file     : 'dist/photo-sphere-viewer.js',
    name     : 'PhotoSphereViewer',
    format   : 'umd',
    globals  : {
      'three'  : 'THREE',
      'uevent' : 'uEvent'
    },
    banner   : `/*!
 * Photo Sphere Viewer ${pkg.version}
 * @copyright 2014-2015 Jérémy Heleine
 * @copyright 2015-${new Date().getFullYear()} Damien "Mistic" Sorel
 * @licence MIT (https://opensource.org/licenses/MIT)
 */`
  },
  external: [
    'three',
    'uevent'
  ],
  plugins : [
    babel({
      exclude                 : 'node_modules/**',
      externalHelpersWhitelist: [
        'assertThisInitialized',
        'defineProperties',
        'createClass',
        'inheritsLoose',
        'defineProperty'
      ]
    }),
    string({
      include: [
        'src/icons/*.svg'
      ]
    })
  ]
};
