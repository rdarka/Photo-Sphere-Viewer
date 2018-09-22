import * as THREE from 'three';
import { PSVHUD } from './components/PSVHUD';
import { PSVLoader } from './components/PSVLoader';
import { PSVNavbar } from './components/PSVNavbar';
import { PSVNotification } from './components/PSVNotification';
import { PSVOverlay } from './components/PSVOverlay';
import { PSVPanel } from './components/PSVPanel';
import { PSVTooltip } from './components/PSVTooltip';
import { getConfig } from './data/config';
import { ANGLE_THRESHOLD, IDS, MARKER_DATA, VIEWER_DATA } from './data/constants';
import { getIcons } from './data/icons';
import { SYSTEM } from './data/system';
import { getTemplates } from './data/templates';
import { PSVAnimation } from './PSVAnimation';
import { PSVError } from './PSVError';
import { PSVDataHelper } from './services/PSVDataHelper';
import { PSVEventsHandler } from './services/PSVEventsHandler';
import { PSVRenderer } from './services/PSVRenderer';
import { PSVTextureLoader } from './services/PSVTextureLoader';
import {
  bound,
  each,
  exitFullscreen,
  getClosest,
  getShortestArc,
  intersect,
  isFullscreenEnabled,
  requestFullscreen,
  toggleClass
} from './utils';

/**
 * @summary Main class
 */
class PhotoSphereViewer {

  /**
   * @param {PhotoSphereViewer.Options} options
   * @fires PhotoSphereViewer.ready
   * @throws {PSVError} when the configuration is incorrect
   */
  constructor(options) {
    SYSTEM.load();

    /**
     * @summary Internal properties
     * @member {Object}
     * @protected
     * @property {boolean} ready - when all components are loaded
     * @property {boolean} needsUpdate - if the view needs to be renderer
     * @property {boolean} isCubemap - if the panorama is a cubemap
     * @property {PhotoSphereViewer.Position} position - current direction of the camera
     * @property {external:THREE.Vector3} direction - direction of the camera
     * @property {number} zoomLvl - current zoom level
     * @property {number} vFov - vertical FOV
     * @property {number} hFov - horizontal FOV
     * @property {number} aspect - viewer aspect ratio
     * @property {number} moveSpeed - move speed (computed with pixel ratio and configuration moveSpeed)
     * @property {number} gyroAlphaOffset - current alpha offset for gyroscope controls
     * @property {Function} orientationCb - update callback of the device orientation
     * @property {Function} autorotateCb - update callback of the automatic rotation
     * @property {PSVAnimation} animationPromise - promise of the current animation (either go to position or image transition)
     * @property {Promise} loadingPromise - promise of the setPanorama method
     * @property startTimeout - timeout id of the automatic rotation delay
     * @property {PhotoSphereViewer.Size} size - size of the container
     * @property {PhotoSphereViewer.PanoData} panoData - panorama metadata
     * @property {external:NoSleep} noSleep - NoSleep.js instance
     */
    this.prop = {
      ready           : false,
      needsUpdate     : false,
      isCubemap       : undefined,
      position        : {
        longitude: 0,
        latitude : 0,
      },
      direction       : null,
      zoomLvl         : 0,
      vFov            : 0,
      hFov            : 0,
      aspect          : 0,
      moveSpeed       : 0.1,
      gyroAlphaOffset : 0,
      orientationCb   : null,
      autorotateCb    : null,
      animationPromise: null,
      loadingPromise  : null,
      startTimeout    : null,
      size            : {
        width : 0,
        height: 0,
      },
      panoData        : {
        fullWidth    : 0,
        fullHeight   : 0,
        croppedWidth : 0,
        croppedHeight: 0,
        croppedX     : 0,
        croppedY     : 0,
      },
      noSleep         : null,
    };

    /**
     * @summary Configuration holder
     * @type {PhotoSphereViewer.Options}
     * @readonly
     */
    this.config = getConfig(options);

    /**
     * @summary Top most parent
     * @member {HTMLElement}
     * @readonly
     */
    this.parent = (typeof options.container === 'string') ? document.getElementById(options.container) : options.container;
    this.parent[VIEWER_DATA] = this;

    /**
     * @summary Main container
     * @member {HTMLElement}
     * @readonly
     */
    this.container = document.createElement('div');
    this.container.classList.add('psv-container');
    this.parent.appendChild(this.container);

    /**
     * @summary Templates holder
     * @type {Object<string, Function>}
     * @readonly
     */
    this.templates = getTemplates(options.templates);

    /**
     * @summary Icons holder
     * @type {Object<string, string>}
     * @readonly
     */
    this.icons = getIcons(options.icons);

    /**
     * @summary Main render controller
     * @type {module:services.PSVRenderer}
     * @readonly
     */
    this.renderer = new PSVRenderer(this);

    /**
     * @summary Textures loader
     * @type {module:services.PSVTextureLoader}
     * @readonly
     */
    this.textureLoader = new PSVTextureLoader(this);

    /**
     * @summary Main event handler
     * @type {module:services.PSVEventsHandler}
     * @readonly
     */
    this.eventsHandler = new PSVEventsHandler(this);

    /**
     * @summary Utilities to help converting data
     * @type {module:services.PSVDataHelper}
     * @readonly
     */
    this.dataHelper = new PSVDataHelper(this);

    /**
     * @member {module:components.PSVLoader}
     * @readonly
     */
    this.loader = new PSVLoader(this);

    /**
     * @member {module:components.PSVNavbar}
     * @readonly
     */
    this.navbar = new PSVNavbar(this);

    /**
     * @member {module:components.PSVHUD}
     * @readonly
     */
    this.hud = new PSVHUD(this);

    /**
     * @member {module:components.PSVPanel}
     * @readonly
     */
    this.panel = new PSVPanel(this);

    /**
     * @member {module:components.PSVTooltip}
     * @readonly
     */
    this.tooltip = new PSVTooltip(this.hud);

    /**
     * @member {module:components.PSVNotification}
     * @readonly
     */
    this.notification = new PSVNotification(this);

    /**
     * @member {module:components.PSVOverlay}
     * @readonly
     */
    this.overlay = new PSVOverlay(this);

    this.eventsHandler.init();

    // apply container size
    this.resize(this.config.size);

    // apply default zoom level
    this.zoom(this.config.defaultZoomLvl);

    // actual move speed depends on pixel-ratio
    this.prop.moveSpeed = THREE.Math.degToRad(this.config.moveSpeed / SYSTEM.pixelRatio);

    // set default position
    this.rotate({
      longitude: this.config.defaultLong,
      latitude : this.config.defaultLat,
    });

    // load panorama
    if (this.config.panorama) {
      this.setPanorama(this.config.panorama);
    }

    // enable GUI after first render
    this.once('render', () => {
      if (this.config.navbar) {
        this.container.classList.add('psv--has-navbar');
        this.navbar.show();
      }

      this.hud.show();

      if (this.config.markers) {
        this.hud.setMarkers(this.config.markers);
      }

      // Queue autorotate
      if (this.config.timeAnim !== false) {
        this.prop.startTimeout = setTimeout(() => this.startAutorotate(), this.config.timeAnim);
      }

      this.prop.ready = true;

      setTimeout(() => {
        /**
         * @event ready
         * @memberof PhotoSphereViewer
         * @summary Triggered when the panorama image has been loaded and the viewer is ready to perform the first render
         */
        this.trigger('ready');
      }, 0);
    });

    SYSTEM.isTouchEnabled.then(enabled => toggleClass(this.container, 'psv--is-touch', enabled));
  }

  /**
   * @summary Destroys the viewer
   * @description The memory used by the ThreeJS context is not totally cleared. This will be fixed as soon as possible.
   */
  destroy() {
    this.__stopAll();
    this.stopKeyboardControl();
    this.stopNoSleep();
    this.exitFullscreen();
    this.unlockOrientation();

    this.eventsHandler.destroy();
    this.renderer.destroy();
    this.textureLoader.destroy();
    this.dataHelper.destroy();

    this.loader.destroy();
    this.navbar.destroy();
    this.tooltip.destroy();
    this.notification.destroy();
    this.hud.destroy();
    this.panel.destroy();
    this.overlay.destroy();

    this.parent.removeChild(this.container);
    delete this.parent[VIEWER_DATA];

    delete this.parent;
    delete this.container;

    delete this.loader;
    delete this.navbar;
    delete this.hud;
    delete this.panel;
    delete this.tooltip;
    delete this.notification;
    delete this.overlay;

    delete this.config;
    delete this.templates;
    delete this.icons;
  }

  /**
   * @summary Returns the current position of the camera
   * @returns {PhotoSphereViewer.Position}
   */
  getPosition() {
    return {
      longitude: this.prop.position.longitude,
      latitude : this.prop.position.latitude,
    };
  }

  /**
   * @summary Returns the current zoom level
   * @returns {number}
   */
  getZoomLevel() {
    return this.prop.zoomLvl;
  }

  /**
   * @summary Returns the current viewer size
   * @returns {PhotoSphereViewer.Size}
   */
  getSize() {
    return {
      width : this.prop.size.width,
      height: this.prop.size.height,
    };
  }

  /**
   * @summary Checks if the automatic rotation is enabled
   * @returns {boolean}
   */
  isAutorotateEnabled() {
    return !!this.prop.autorotateCb;
  }

  /**
   * @summary Checks if the gyroscope is enabled
   * @returns {boolean}
   */
  isGyroscopeEnabled() {
    return !!this.prop.orientationCb;
  }

  /**
   * @summary Checks if the stereo viewx is enabled
   * @returns {boolean}
   */
  isStereoEnabled() {
    return !!this.renderer.stereoEffect;
  }

  /**
   * @summary Checks if the viewer is in fullscreen
   * @returns {boolean}
   */
  isFullscreenEnabled() {
    return isFullscreenEnabled(this.container);
  }

  /**
   * @summary Flags the view has changed for the next render
   */
  needsUpdate() {
    this.prop.needsUpdate = true;
  }

  /**
   * @summary Resizes the canvas when the window is resized
   * @fires PhotoSphereViewer.size-updated
   */
  autoSize() {
    if (this.container.clientWidth !== this.prop.size.width || this.container.clientHeight !== this.prop.size.height) {
      this.prop.size.width = Math.round(this.container.clientWidth);
      this.prop.size.height = Math.round(this.container.clientHeight);
      this.prop.aspect = this.prop.size.width / this.prop.size.height;
      this.needsUpdate();

      /**
       * @event size-updated
       * @memberof PhotoSphereViewer
       * @summary Triggered when the viewer size changes
       * @param {PhotoSphereViewer.Size} size
       */
      this.trigger('size-updated', this.getSize());
    }
  }

  /**
   * @summary Loads a new panorama file
   * @description Loads a new panorama file, optionally changing the camera position and activating the transition animation.<br>
   * If the "position" is not defined, the camera will not move and the ongoing animation will continue<br>
   * "config.transition" must be configured for "transition" to be taken in account
   * @param {string|string[]} path - URL of the new panorama file
   * @param {PhotoSphereViewer.ExtendedPosition} [position]
   * @param {boolean} [transition=false]
   * @returns {Promise}
   * @throws {PSVError} when another panorama is already loading
   */
  setPanorama(path, position, transition) {
    if (this.prop.loadingPromise !== null) {
      throw new PSVError('Loading already in progress');
    }

    if (typeof position === 'boolean') {
      transition = position; // eslint-disable-line no-param-reassign
      position = undefined; // eslint-disable-line no-param-reassign
    }

    let cleanPosition;
    if (position) {
      cleanPosition = this.dataHelper.cleanPosition(position);

      this.__stopAll();
    }

    this.hideError();

    this.config.panorama = path;

    const done = () => {
      this.loader.hide();
      this.renderer.show();

      this.prop.loadingPromise = null;
    };

    if (!transition || !this.config.transition || !this.prop.ready) {
      this.loader.show();
      this.renderer.hide();

      this.prop.loadingPromise = this.textureLoader.loadTexture(this.config.panorama)
        .then((texture) => {
          this.renderer.setTexture(texture);

          if (cleanPosition) {
            this.rotate(cleanPosition);
          }
        })
        .catch(e => console.error(e))
        .then(done, done);
    }
    else {
      if (this.config.transition.loader) {
        this.loader.show();
      }

      this.prop.loadingPromise = this.textureLoader.loadTexture(this.config.panorama)
        .then((texture) => {
          this.loader.hide();

          return this.renderer.transition(texture, cleanPosition);
        })
        .catch(e => console.error(e))
        .then(done, done);
    }

    return this.prop.loadingPromise;
  }

  /**
   * @summary Starts the automatic rotation
   * @fires PhotoSphereViewer.autorotate
   */
  startAutorotate() {
    this.__stopAll();

    this.prop.autorotateCb = (() => {
      let last;
      let elapsed;

      return (timestamp) => {
        elapsed = last === undefined ? 0 : timestamp - last;
        last = timestamp;

        this.rotate({
          longitude: this.prop.position.longitude + this.config.animSpeed * elapsed / 1000,
          latitude : this.prop.position.latitude - (this.prop.position.latitude - this.config.animLat) / 200,
        });
      };
    })();

    this.on('before-render', this.prop.autorotateCb);

    /**
     * @event autorotate
     * @memberof PhotoSphereViewer
     * @summary Triggered when the automatic rotation is enabled/disabled
     * @param {boolean} enabled
     */
    this.trigger('autorotate', true);
  }

  /**
   * @summary Stops the automatic rotation
   * @fires PhotoSphereViewer.autorotate
   */
  stopAutorotate() {
    if (this.prop.startTimeout) {
      clearTimeout(this.prop.startTimeout);
      this.prop.startTimeout = null;
    }

    if (this.isAutorotateEnabled()) {
      this.off('before-render', this.prop.autorotateCb);
      this.prop.autorotateCb = null;

      this.trigger('autorotate', false);
    }
  }

  /**
   * @summary Starts or stops the automatic rotation
   */
  toggleAutorotate() {
    if (this.isAutorotateEnabled()) {
      this.stopAutorotate();
    }
    else {
      this.startAutorotate();
    }
  }

  /**
   * @summary Enables the gyroscope navigation if available
   * @fires PhotoSphereViewer.gyroscope-updated
   * @throws {PSVError} if DeviceOrientationControls.js is missing
   */
  startGyroscopeControl() {
    if (SYSTEM.checkTHREE('DeviceOrientationControls')) {
      return SYSTEM.isDeviceOrientationSupported.then((supported) => {
        if (supported) {
          this.__stopAll();

          this.renderer.startGyroscopeControl();

          /**
           * @event gyroscope-updated
           * @memberof PhotoSphereViewer
           * @summary Triggered when the gyroscope mode is enabled/disabled
           * @param {boolean} enabled
           */
          this.trigger('gyroscope-updated', true);

          return true;
        }
        else {
          console.warn('PhotoSphereViewer: gyroscope not available');
          return Promise.reject();
        }
      });
    }
    else {
      throw new PSVError('Missing Three.js components: DeviceOrientationControls. Get them from three.js-examples package.');
    }
  }

  /**
   * @summary Disables the gyroscope navigation
   * @fires PhotoSphereViewer.gyroscope-updated
   */
  stopGyroscopeControl() {
    if (this.isGyroscopeEnabled()) {
      this.renderer.stopGyroscopeControl();

      this.trigger('gyroscope-updated', false);
    }
  }

  /**
   * @summary Enables or disables the gyroscope navigation
   */
  toggleGyroscopeControl() {
    if (this.isGyroscopeEnabled()) {
      this.stopGyroscopeControl();
    }
    else {
      this.startGyroscopeControl();
    }
  }

  /**
   * @summary Enables NoSleep.js
   */
  startNoSleep() {
    if (!('NoSleep' in window)) {
      console.warn('PhotoSphereViewer: NoSleep is not available');
      return;
    }

    if (!this.prop.noSleep) {
      this.prop.noSleep = new window.NoSleep();
    }

    this.prop.noSleep.enable();
  }

  /**
   * @summary Disables NoSleep.js
   */
  stopNoSleep() {
    if (this.prop.noSleep) {
      this.prop.noSleep.disable();
    }
  }

  /**
   * @summary Enables the stereo view
   * @description
   *  - enables NoSleep.js
   *  - enables full screen
   *  - starts gyroscope controle
   *  - hides hud, navbar and panel
   *  - instanciate StereoEffect
   * @throws {PSVError} if StereoEffect.js is not available
   */
  startStereoView() {
    if (SYSTEM.checkTHREE('DeviceOrientationControls', 'StereoEffect')) {
      // Need to be in the main event queue
      this.startNoSleep();
      this.enterFullscreen();
      this.lockOrientation();

      this.startGyroscopeControl().then(() => {
        this.renderer.startStereoView();
        this.needsUpdate();

        this.hud.hide();
        this.navbar.hide();
        this.panel.hide();

        /**
         * @event stereo-updated
         * @memberof PhotoSphereViewer
         * @summary Triggered when the stereo view is enabled/disabled
         * @param {boolean} enabled
         */
        this.trigger('stereo-updated', true);

        this.notification.show({
          content: this.config.lang.stereoNotification,
          timeout: 3000,
        });
      }, () => {
        this.unlockOrientation();
        this.exitFullscreen();
        this.stopNoSleep();
      });
    }
    else {
      throw new PSVError('Missing Three.js components: StereoEffect, DeviceOrientationControls. Get them from three.js-examples package.');
    }
  }

  /**
   * @summary Disables the stereo view
   */
  stopStereoView() {
    if (this.isStereoEnabled()) {
      this.renderer.stopStereoView();
      this.needsUpdate();

      this.hud.show();
      this.navbar.show();

      this.unlockOrientation();
      this.exitFullscreen();
      this.stopNoSleep();
      this.stopGyroscopeControl();

      this.trigger('stereo-updated', false);
    }
  }

  /**
   * @summary Enables or disables the stereo view
   */
  toggleStereoView() {
    if (this.isStereoEnabled()) {
      this.stopStereoView();
    }
    else {
      this.startStereoView();
    }
  }

  /**
   * @summary Displays an error message
   * @param {string} message
   */
  showError(message) {
    this.overlay.show({
      id   : IDS.ERROR,
      image: this.icons.error,
      text : message,
    });
  }

  /**
   * @summary Hides the error message
   */
  hideError() {
    this.overlay.hide(IDS.ERROR);
  }

  /**
   * @summary Tries to lock the device in landscape or display a message
   */
  lockOrientation() {
    let displayRotateMessageTimeout;

    const displayRotateMessage = () => {
      if (this.isStereoEnabled() && window.innerHeight > window.innerWidth) {
        this.overlay.show({
          id     : IDS.PLEASE_ROTATE,
          image  : this.icons.mobileRotate,
          text   : this.config.lang.pleaseRotate[0],
          subtext: this.config.lang.pleaseRotate[1],
        });
      }

      if (displayRotateMessageTimeout) {
        clearTimeout(displayRotateMessageTimeout);
      }
    };

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.lock('landscape').then(null, () => displayRotateMessage());
      displayRotateMessageTimeout = setTimeout(() => displayRotateMessage(), 500);
    }
    else {
      displayRotateMessage();
    }
  }

  /**
   * @summary Unlock the device orientation
   */
  unlockOrientation() {
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.unlock();
    }
    else {
      this.overlay.hide(IDS.PLEASE_ROTATE);
    }
  }

  /**
   * @summary Rotates the view to specific longitude and latitude
   * @param {PhotoSphereViewer.ExtendedPosition} position
   * @fires PhotoSphereViewer.position-updated
   */
  rotate(position) {
    const cleanPosition = this.dataHelper.cleanPosition(position);
    const { rangedPosition, sidesReached } = this.dataHelper.applyRanges(cleanPosition);

    if (intersect(['left', 'right'], sidesReached).length > 0) {
      this.renderer.reverseAutorotate();
    }

    this.prop.position.longitude = rangedPosition.longitude;
    this.prop.position.latitude = rangedPosition.latitude;
    this.needsUpdate();

    /**
     * @event position-updated
     * @memberof PhotoSphereViewer
     * @summary Triggered when the view longitude and/or latitude changes
     * @param {PhotoSphereViewer.Position} position
     */
    this.trigger('position-updated', this.getPosition());
  }

  /**
   * @summary Rotates the view to specific longitude and latitude with a smooth animation
   * @param {PhotoSphereViewer.ExtendedPosition} position
   * @param {string|number} speed - animation speed or duration (in milliseconds)
   * @returns {PSVAnimation}
   */
  animate(position, speed) {
    this.__stopAll();

    const cleanPosition = this.dataHelper.cleanPosition(position);
    const { rangedPosition } = this.dataHelper.applyRanges(cleanPosition);

    const currentPosition = this.prop.position;
    const dLongitude = Math.abs(cleanPosition.longitude - currentPosition.longitude);
    const dLatitude = Math.abs(cleanPosition.latitude - currentPosition.latitude);
    if (!speed || (dLongitude < ANGLE_THRESHOLD && dLatitude < ANGLE_THRESHOLD)) {
      this.rotate(cleanPosition);
      return PSVAnimation.resolve();
    }

    const duration = this.dataHelper.speedToDuration(speed, rangedPosition);

    // longitude offset for shortest arc
    const tOffset = getShortestArc(currentPosition.longitude, rangedPosition.longitude);

    this.prop.animationPromise = new PSVAnimation({
      properties: {
        longitude: { start: currentPosition.longitude, end: currentPosition.longitude + tOffset },
        latitude : { start: currentPosition.latitude, end: rangedPosition.latitude },
      },
      duration  : duration,
      easing    : 'inOutSine',
      onTick    : (newPosition) => {
        this.rotate(newPosition);
      },
    });

    return this.prop.animationPromise;
  }

  /**
   * @summary Stops the ongoing animation
   * @description The return value is a Promise because the is no guaranty the animation can be stopped synchronously.
   * @returns {Promise} Resolved when the animation has ben cancelled
   */
  stopAnimation() {
    if (this.prop.animationPromise) {
      return new Promise((resolve) => {
        this.prop.animationPromise.finally(resolve);
        this.prop.animationPromise.cancel();
        this.prop.animationPromise = null;
      });
    }
    else {
      return Promise.resolve();
    }
  }

  /**
   * @summary Zooms to a specific level between `max_fov` and `min_fov`
   * @param {number} level - new zoom level from 0 to 100
   * @fires PhotoSphereViewer.zoom-updated
   */
  zoom(level) {
    this.prop.zoomLvl = bound(Math.round(level), 0, 100);
    this.prop.vFov = this.dataHelper.zoomLevelToFov(this.prop.zoomLvl);
    this.prop.hFov = this.dataHelper.vFovToHFov(this.prop.vFov);
    this.needsUpdate();

    /**
     * @event zoom-updated
     * @memberof PhotoSphereViewer
     * @summary Triggered when the zoom level changes
     * @param {number} zoomLevel
     */
    this.trigger('zoom-updated', this.getZoomLevel());
  }

  /**
   * @summary Increases the zoom level by 1
   */
  zoomIn() {
    if (this.prop.zoomLvl < 100) {
      this.zoom(this.prop.zoomLvl + this.config.zoomSpeed);
    }
  }

  /**
   * @summary Decreases the zoom level by 1
   */
  zoomOut() {
    if (this.prop.zoomLvl > 0) {
      this.zoom(this.prop.zoomLvl - this.config.zoomSpeed);
    }
  }

  /**
   * @summary Resizes the viewer
   * @param {PhotoSphereViewer.CssSize} size
   */
  resize(size) {
    ['width', 'height'].forEach((dim) => {
      if (size && size[dim]) {
        if (/^[0-9.]+$/.test(size[dim])) {
          size[dim] += 'px';
        }
        this.parent.style[dim] = size[dim];
      }
    });

    this.autoSize();
  }

  /**
   * @summary Enters the fullscreen mode
   */
  enterFullscreen() {
    requestFullscreen(this.container);
  }

  /**
   * @summary Exits the fullscreen mode
   */
  exitFullscreen() {
    exitFullscreen();
  }

  /**
   * @summary Enters or exits the fullscreen mode
   */
  toggleFullscreen() {
    if (!this.isFullscreenEnabled()) {
      this.enterFullscreen();
    }
    else {
      this.exitFullscreen();
    }
  }

  /**
   * @summary Enables the keyboard controls (done automatically when entering fullscreen)
   */
  startKeyboardControl() {
    this.eventsHandler.enableKeyboard();
  }

  /**
   * @summary Disables the keyboard controls (done automatically when exiting fullscreen)
   */
  stopKeyboardControl() {
    this.eventsHandler.disableKeyboard();
  }

  /**
   * @summary Stops all current animations
   * @private
   */
  __stopAll() {
    this.stopAutorotate();
    this.stopAnimation();
    this.stopGyroscopeControl();
    this.stopStereoView();
  }

  /**
   * @summary Toggles the visibility of markers list
   */
  toggleMarkersList() {
    if (this.panel.prop.id === IDS.MARKERS_LIST) {
      this.hideMarkersList();
    }
    else {
      this.showMarkersList();
    }
  }

  /**
   * @summary Opens side panel with list of markers
   * @fires module:components.PSVHUD.filter:render-markers-list
   */
  showMarkersList() {
    let markers = [];
    each(this.hud.markers, marker => markers.push(marker));

    /**
     * @event filter:render-markers-list
     * @memberof module:components.PSVHUD
     * @summary Used to alter the list of markers displayed on the side-panel
     * @param {PSVMarker[]} markers
     * @returns {PSVMarker[]}
     */
    markers = this.change('render-markers-list', markers);

    this.panel.show({
      id      : IDS.MARKERS_LIST,
      content : this.templates.markersList(markers, this),
      noMargin: true,
    });

    const markersList = this.panel.container.querySelector('.psv-markers-list');

    markersList.addEventListener('click', (e) => {
      const li = e.target ? getClosest(e.target, 'li') : undefined;
      const markerId = li ? li.dataset[MARKER_DATA] : undefined;

      if (markerId) {
        const marker = this.hud.getMarker(markerId);

        /**
         * @event select-marker-list
         * @memberof module:components.PSVHUD
         * @summary Triggered when a marker is selected from the side panel
         * @param {PSVMarker} marker
         */
        this.trigger('select-marker-list', marker);

        this.hud.gotoMarker(marker, 1000);
        this.hideMarkersList();
      }
    });
  }

  /**
   * @summary Closes side panel if it contains the list of markers
   */
  hideMarkersList() {
    this.panel.hide(IDS.MARKERS_LIST);
  }

}

export { PhotoSphereViewer };
