/**
 * @module data/config
 */

import { PSVError } from '../PSVError';
import { bound, clone, deepmerge, isInteger, parseAngle, parseSpeed } from '../utils';
import { ACTIONS } from './constants';
import { SYSTEM } from './system';

/**
 * @summary Default options
 * @type {PhotoSphereViewer.Options}
 * @constant
 * @memberOf module:data/config
 */
const DEFAULTS = {
  panorama           : null,
  container          : null,
  caption            : null,
  useXmpData         : true,
  panoData           : null,
  webgl              : true,
  minFov             : 30,
  maxFov             : 90,
  defaultZoomLvl     : 50,
  defaultLong        : 0,
  defaultLat         : 0,
  sphereCorrection   : {
    pan : 0,
    tilt: 0,
    roll: 0,
  },
  longitudeRange     : null,
  latitudeRange      : null,
  moveSpeed          : 1,
  zoomSpeed          : 2,
  timeAnim           : 2000,
  animSpeed          : '2rpm',
  animLat            : null,
  fisheye            : false,
  navbar             : [
    'autorotate',
    'zoom',
    'download',
    'markers',
    'caption',
    'gyroscope',
    'stereo',
    'fullscreen',
  ],
  lang               : {
    autorotate        : 'Automatic rotation',
    zoom              : 'Zoom',
    zoomOut           : 'Zoom out',
    zoomIn            : 'Zoom in',
    download          : 'Download',
    fullscreen        : 'Fullscreen',
    markers           : 'Markers',
    gyroscope         : 'Gyroscope',
    stereo            : 'Stereo view',
    stereoNotification: 'Click anywhere to exit stereo view.',
    pleaseRotate      : ['Please rotate your device', '(or tap to continue)'],
    twoFingers        : ['Use two fingers to navigate'],
  },
  mousewheel         : true,
  mousewheelFactor   : 1,
  mousemove          : true,
  mousemoveHover     : false,
  touchmoveTwoFingers: false,
  keyboard           : {
    'ArrowUp'   : ACTIONS.ROTATE_LAT_UP,
    'ArrowDown' : ACTIONS.ROTATE_LAT_DOWN,
    'ArrowRight': ACTIONS.ROTATE_LONG_RIGHT,
    'ArrowLeft' : ACTIONS.ROTATE_LONG_LEFT,
    'PageUp'    : ACTIONS.ZOOM_IN,
    'PageDown'  : ACTIONS.ZOOM_OUT,
    '+'         : ACTIONS.ZOOM_IN,
    '-'         : ACTIONS.ZOOM_OUT,
    ' '         : ACTIONS.TOGGLE_AUTOROTATE,
  },
  moveInertia        : true,
  clickEventOnMarker : false,
  transition         : {
    duration: 1500,
    loader  : true,
  },
  loadingImg         : null,
  loadingTxt         : 'Loading...',
  size               : null,
  cacheTexture       : 0,
  templates          : {},
  icons              : {},
  markers            : [],
  withCredentials    : false,
};

/**
 * @summary Merge and clean user config with default config
 * @param {PhotoSphereViewer.Options} options
 * @returns {PhotoSphereViewer.Options}
 * @memberOf module:data/config
 */
function getConfig(options) {
  const config = clone(DEFAULTS);
  deepmerge(config, options);

  // check container
  if (!config.container) {
    throw new PSVError('No value given for container.');
  }

  // must support canvas
  if (!SYSTEM.isCanvasSupported) {
    throw new PSVError('Canvas is not supported.');
  }

  // additional scripts if webgl not supported/disabled
  if ((!SYSTEM.isWebGLSupported || !config.webgl) && !SYSTEM.checkTHREE('CanvasRenderer', 'Projector')) {
    throw new PSVError('Missing Three.js components: CanvasRenderer, Projector. Get them from three.js-examples package.');
  }

  // longitude range must have two values
  if (config.longitudeRange && config.longitudeRange.length !== 2) {
    config.longitudeRange = null;
    console.warn('PhotoSphereViewer: longitudeRange must have exactly two elements.');
  }

  if (config.latitudeRange) {
    // latitude range must have two values
    if (config.latitudeRange.length !== 2) {
      config.latitudeRange = null;
      console.warn('PhotoSphereViewer: latitudeRange must have exactly two elements.');
    }
    // latitude range must be ordered
    else if (config.latitudeRange[0] > config.latitudeRange[1]) {
      config.latitudeRange = [config.latitudeRange[1], config.latitudeRange[0]];
      console.warn('PhotoSphereViewer: latitudeRange values must be ordered.');
    }
  }

  // min_fov and maxFov must be ordered
  if (config.maxFov < config.minFov) {
    [config.maxFov, config.minFov] = [config.minFov, config.maxFov];
    console.warn('PhotoSphereViewer: maxFov cannot be lower than minFov.');
  }

  // cache_texture must be a positive integer or false
  if (config.cacheTexture && (!isInteger(config.cacheTexture) || config.cacheTexture < 0)) {
    config.cacheTexture = 0;
    console.warn('PhotoSphereViewer: invalid value for cacheTexture');
  }

  // navbar=true becomes the default array
  if (config.navbar === true) {
    config.navbar = clone(DEFAULTS.navbar);
  }
  // navbar can be a space separated list
  else if (typeof config.navbar === 'string') {
    config.navbar = config.navbar.split(' ');
  }

  // keyboard=true becomes the default map
  if (config.keyboard === true) {
    config.keyboard = clone(DEFAULTS.keyboard);
  }

  // min_fov/max_fov between 1 and 179
  config.minFov = bound(config.minFov, 1, 179);
  config.maxFov = bound(config.maxFov, 1, 179);

  // defaultZoomLvl between 0 and 100
  config.defaultZoomLvl = bound(config.defaultZoomLvl, 0, 100);

  // parse defaultLong, is between 0 and 2*PI
  config.defaultLong = parseAngle(config.defaultLong);

  // parse defaultLat, is between -PI/2 and PI/2
  config.defaultLat = parseAngle(config.defaultLat, true);

  // parse sphereCorrection, is between -PI/2 and PI/2
  config.sphereCorrection.pan = parseAngle(config.sphereCorrection.pan, true);
  config.sphereCorrection.tilt = parseAngle(config.sphereCorrection.tilt, true);
  config.sphereCorrection.roll = parseAngle(config.sphereCorrection.roll, true);

  // default animLat is default_lat
  if (config.animLat === null) {
    config.animLat = config.defaultLat;
  }
  // parse animLat, is between -PI/2 and PI/2
  else {
    config.animLat = parseAngle(config.animLat, true);
  }

  // parse longitudeRange, between 0 and 2*PI
  if (config.longitudeRange) {
    config.longitudeRange = config.longitudeRange.map(angle => parseAngle(angle));
  }

  // parse latitudeRange, between -PI/2 and PI/2
  if (config.latitudeRange) {
    config.latitudeRange = config.latitudeRange.map(angle => parseAngle(angle, true));
  }

  // parse anim_speed
  config.animSpeed = parseSpeed(config.animSpeed);

  // reactivate the navbar if the caption is provided
  if (config.caption && !config.navbar) {
    config.navbar = ['caption'];
  }

  // translate boolean fisheye to amount
  if (config.fisheye === true) {
    config.fisheye = 1;
  }
  else if (config.fisheye === false) {
    config.fisheye = 0;
  }

  return config;
}

export { DEFAULTS, getConfig };
