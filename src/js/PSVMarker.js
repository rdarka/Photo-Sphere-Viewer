import { EASINGS, MARKER_DATA, MARKER_TYPES, SVG_NS } from './data/constants';
import { PSVError } from './PSVError';
import { addClasses, dasherize, deepmerge, each, parseAngle, parsePosition } from './utils';

/**
 * @typedef {Object} PSVMarker.Properties
 * @summary Marker properties, see {@link http://photo-sphere-viewer.js.org/markers.html#config}
 */

/**
 * Object representing a marker
 */
class PSVMarker {

  /**
   * @param {PSVMarker.Properties} properties
   * @param {PhotoSphereViewer} psv
   * @throws {PSVError} when the configuration is incorrect
   */
  constructor(properties, psv) {
    if (!properties.id) {
      throw new PSVError('missing marker id');
    }

    if (properties.image && (!properties.width || !properties.height)) {
      throw new PSVError('missing marker width/height');
    }

    if (properties.image || properties.html) {
      if ((!('x' in properties) || !('y' in properties)) && (!('latitude' in properties) || !('longitude' in properties))) {
        throw new PSVError('missing marker position, latitude/longitude or x/y');
      }
    }

    /**
     * @member {PhotoSphereViewer}
     * @readonly
     * @protected
     */
    this.psv = psv;

    /**
     * @member {string}
     * @readonly
     */
    this.id = properties.id;

    /**
     * @member {string}
     * @see PSVMarker.types
     * @readonly
     */
    this.type = PSVMarker.getType(properties, false);

    /**
     * @member {boolean}
     * @protected
     */
    this.visible = true;

    /**
     * @member {HTMLElement|SVGElement}
     * @readonly
     */
    this.$el = null;

    /**
     * @summary Original configuration of the marker
     * @member {PSVMarker.Properties}
     * @readonly
     */
    this.config = {};

    /**
     * @summary Computed properties
     * @member {Object}
     * @protected
     * @property {boolean} dynamicSize
     * @property {PhotoSphereViewer.Point} anchor
     * @property {PhotoSphereViewer.Position} position
     * @property {PhotoSphereViewer.Point} position2D
     * @property {external:THREE.Vector3[]} positions3D
     * @property {number} width
     * @property {number} height
     * @property {*} def
     */
    this.props = {
      dynamicSize: false,
      anchor     : null,
      position   : null,
      position2D : null,
      positions3D: null,
      width      : null,
      height     : null,
      def        : null,
    };

    // create element
    if (this.isNormal()) {
      this.$el = document.createElement('div');
    }
    else if (this.isPolygon()) {
      this.$el = document.createElementNS(SVG_NS, 'polygon');
    }
    else if (this.isPolyline()) {
      this.$el = document.createElementNS(SVG_NS, 'polyline');
    }
    else {
      this.$el = document.createElementNS(SVG_NS, this.type);
    }

    this.$el.id = `psv-marker-${this.id}`;
    this.$el[MARKER_DATA] = this;

    this.update(properties);
  }

  /**
   * @summary Destroys the marker
   */
  destroy() {
    delete this.$el[MARKER_DATA];
    delete this.$el;
    delete this.config;
    delete this.props;
    delete this.psv;
  }

  /**
   * @summary Checks if it is a normal marker (image or html)
   * @returns {boolean}
   */
  isNormal() {
    return this.type === MARKER_TYPES.image
      || this.type === MARKER_TYPES.html;
  }

  /**
   * @summary Checks if it is a polygon/polyline marker
   * @returns {boolean}
   */
  isPoly() {
    return this.isPolygon()
      || this.isPolyline();
  }

  /**
   * @summary Checks if it is a polygon/polyline using pixel coordinates
   * @returns {boolean}
   */
  isPolyPx() {
    return this.type === MARKER_TYPES.polygonPx
      || this.type === MARKER_TYPES.polylinePx;
  }

  /**
   * @summary Checks if it is a polygon/polyline using radian coordinates
   * @returns {boolean}
   */
  isPolyRad() {
    return this.type === MARKER_TYPES.polygonRad
      || this.type === MARKER_TYPES.polylineRad;
  }

  /**
   * @summary Checks if it is a polygon marker
   * @returns {boolean}
   */
  isPolygon() {
    return this.type === MARKER_TYPES.polygonPx
      || this.type === MARKER_TYPES.polygonRad;
  }

  /**
   * @summary Checks if it is a polyline marker
   * @returns {boolean}
   */
  isPolyline() {
    return this.type === MARKER_TYPES.polylinePx
      || this.type === MARKER_TYPES.polylineRad;
  }

  /**
   * @summary Checks if it is an SVG marker
   * @returns {boolean}
   */
  isSvg() {
    return this.type === MARKER_TYPES.square
      || this.type === MARKER_TYPES.rect
      || this.type === MARKER_TYPES.circle
      || this.type === MARKER_TYPES.ellipse
      || this.type === MARKER_TYPES.path;
  }

  /**
   * @summary Computes marker scale from zoom level
   * @param {number} zoomLevel
   * @returns {number}
   */
  getScale(zoomLevel) {
    if (Array.isArray(this.config.scale)) {
      return this.config.scale[0] + (this.config.scale[1] - this.config.scale[0]) * EASINGS.inQuad(zoomLevel / 100);
    }
    else if (typeof this.config.scale === 'function') {
      return this.config.scale(zoomLevel);
    }
    else if (typeof this.config.scale === 'number') {
      return this.config.scale * EASINGS.inQuad(zoomLevel / 100);
    }
    else {
      return 1;
    }
  }

  /**
   * @summary Updates the marker with new properties
   * @param {PSVMarker.Properties} [properties]
   * @throws {PSVError} when trying to change the marker's type
   */
  update(properties) {
    if (properties && properties !== this.config) {
      const newType = PSVMarker.getType(properties, true);

      if (newType !== undefined && newType !== this.type) {
        throw new PSVError('cannot change marker type');
      }

      deepmerge(this.config, properties);

      this.visible = properties.visible !== false;
    }

    // reset CSS class
    if (this.isNormal()) {
      this.$el.setAttribute('class', 'psv-marker psv-marker--normal');
    }
    else {
      this.$el.setAttribute('class', 'psv-marker psv-marker--svg');
    }

    // add CSS classes
    if (this.config.className) {
      addClasses(this.$el, this.config.className);
    }
    if (this.config.tooltip) {
      addClasses(this.$el, 'psv-marker--has-tooltip');
      if (typeof this.config.tooltip === 'string') {
        this.config.tooltip = { content: this.config.tooltip };
      }
    }

    // apply style
    if (this.config.style) {
      deepmerge(this.$el.style, this.config.style);
    }

    // parse anchor
    this.props.anchor = parsePosition(this.config.anchor);

    if (this.isNormal()) {
      this.__updateNormal();
    }
    else if (this.isPoly()) {
      this.__updatePoly();
    }
    else {
      this.__updateSvg();
    }
  }

  /**
   * @summary Updates a normal marker
   * @private
   */
  __updateNormal() {
    if (this.config.width && this.config.height) {
      this.props.dynamicSize = false;
      this.props.width = this.config.width;
      this.props.height = this.config.height;
      this.$el.style.width = this.config.width + 'px';
      this.$el.style.height = this.config.height + 'px';
    }
    else {
      this.props.dynamicSize = true;
    }

    if (this.config.image) {
      this.props.def = this.config.image;
      this.$el.style.backgroundImage = `url(${this.config.image})`;
    }
    else if (this.config.html) {
      this.props.def = this.config.html;
      this.$el.innerHTML = this.config.html;
    }

    // set anchor
    this.$el.style.transformOrigin = `${this.props.anchor.x * 100}% ${this.props.anchor.y * 100}%`;

    // convert texture coordinates to spherical coordinates
    this.props.position = this.psv.dataHelper.cleanPosition(this.config);

    // compute x/y/z position
    this.props.positions3D = [this.psv.dataHelper.sphericalCoordsToVector3(this.props.position)];
  }

  /**
   * @summary Updates an SVG marker
   * @private
   */
  __updateSvg() {
    this.props.dynamicSize = true;

    // set content
    switch (this.type) {
      case MARKER_TYPES.square:
        this.props.def = {
          x     : 0,
          y     : 0,
          width : this.config.square,
          height: this.config.square,
        };
        break;

      case MARKER_TYPES.rect:
        if (Array.isArray(this.config.rect)) {
          this.props.def = {
            x     : 0,
            y     : 0,
            width : this.config.rect[0],
            height: this.config.rect[1],
          };
        }
        else {
          this.props.def = {
            x     : 0,
            y     : 0,
            width : this.config.rect.width,
            height: this.config.rect.height,
          };
        }
        break;

      case MARKER_TYPES.circle:
        this.props.def = {
          cx: this.config.circle,
          cy: this.config.circle,
          r : this.config.circle,
        };
        break;

      case MARKER_TYPES.ellipse:
        if (Array.isArray(this.config.ellipse)) {
          this.props.def = {
            cx: this.config.ellipse[0],
            cy: this.config.ellipse[1],
            rx: this.config.ellipse[0],
            ry: this.config.ellipse[1],
          };
        }
        else {
          this.props.def = {
            cx: this.config.ellipse.rx,
            cy: this.config.ellipse.ry,
            rx: this.config.ellipse.rx,
            ry: this.config.ellipse.ry,
          };
        }
        break;

      case MARKER_TYPES.path:
        this.props.def = {
          d: this.config.path,
        };
        break;

      // no default
    }

    each(this.props.def, (value, prop) => {
      this.$el.setAttributeNS(SVG_NS, prop, value);
    });

    // set style
    if (this.config.svgStyle) {
      each(this.config.svgStyle, (value, prop) => {
        this.$el.setAttributeNS(SVG_NS, dasherize(prop), value);
      });
    }
    else {
      this.$el.setAttributeNS(SVG_NS, 'fill', 'rgba(0,0,0,0.5)');
    }

    // convert texture coordinates to spherical coordinates
    this.props.position = this.psv.dataHelper.cleanPosition(this.config);

    // compute x/y/z position
    this.props.positions3D = [this.psv.dataHelper.sphericalCoordsToVector3(this.props.position)];
  }

  /**
   * @summary Updates a polygon marker
   * @private
   */
  __updatePoly() {
    this.props.dynamicSize = true;

    // set style
    if (this.config.svgStyle) {
      each(this.config.svgStyle, (value, prop) => {
        this.$el.setAttributeNS(SVG_NS, dasherize(prop), value);
      });

      if (this.isPolyline() && !this.config.svgStyle.fill) {
        this.$el.setAttributeNS(SVG_NS, 'fill', 'none');
      }
    }
    else if (this.isPolygon()) {
      this.$el.setAttributeNS(SVG_NS, 'fill', 'rgba(0,0,0,0.5)');
    }
    else if (this.isPolyline()) {
      this.$el.setAttributeNS(SVG_NS, 'fill', 'none');
      this.$el.setAttributeNS(SVG_NS, 'stroke', 'rgb(0,0,0)');
    }

    // fold arrays: [1,2,3,4] => [[1,2],[3,4]]
    const actualPoly = this.config.polygonPx || this.config.polygonRad || this.config.polylinePx || this.config.polylineRad;
    if (!Array.isArray(actualPoly[0])) {
      for (let i = 0; i < actualPoly.length; i++) {
        actualPoly.splice(i, 2, [actualPoly[i], actualPoly[i + 1]]);
      }
    }

    // convert texture coordinates to spherical coordinates
    if (this.isPolyPx()) {
      this.props.def = actualPoly.map((coord) => {
        const sphericalCoords = this.psv.dataHelper.textureCoordsToSphericalCoords({ x: coord[0], y: coord[1] });
        return [sphericalCoords.longitude, sphericalCoords.latitude];
      });
    }
    // clean angles
    else {
      this.props.def = actualPoly.map((coord) => {
        return [parseAngle(coord[0]), parseAngle(coord[1], true)];
      });
    }

    // TODO : compute the center of the polygon
    this.props.position = {
      longitude: this.props.def[0][0],
      latitude : this.props.def[0][1],
    };

    // compute x/y/z positions
    this.props.positions3D = this.props.def.map((coord) => {
      return this.psv.dataHelper.sphericalCoordsToVector3({ longitude: coord[0], latitude: coord[1] });
    });
  }

  /**
   * @summary Determines the type of a marker by the available properties
   * @param {PSVMarker.Properties} properties
   * @param {boolean} [allowNone=false]
   * @returns {string}
   * @throws {PSVError} when the marker's type cannot be found
   */
  static getType(properties, allowNone = false) {
    const found = [];

    each(MARKER_TYPES, (type) => {
      if (type in properties) {
        found.push(type);
      }
    });

    if (found.length === 0 && !allowNone) {
      throw new PSVError(`missing marker content, either ${Object.keys(MARKER_TYPES).join(', ')}`);
    }
    else if (found.length > 1) {
      throw new PSVError(`multiple marker content, either ${Object.keys(MARKER_TYPES).join(', ')}`);
    }

    return found[0];
  }

}

export { PSVMarker };
