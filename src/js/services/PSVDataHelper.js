import * as THREE from 'three';
import { SPHERE_RADIUS } from '../data/constants';
import { PSVError } from '../PSVError';
import { clone, getAngle, parseAngle, parseSpeed } from '../utils';
import { AbstractService } from './AbstractService';

/**
 * @summary Collections of data converters for the current viewer
 * @extends module:services.AbstractService
 * @memberof module:services
 */
class PSVDataHelper extends AbstractService {

  /**
   * @param {PhotoSphereViewer} psv
   */
  constructor(psv) {
    super(psv);
  }

  /**
   * @summary Converts vertical FOV to zoom level
   * @param {number} fov
   * @returns {number}
   */
  fovToZoomLevel(fov) {
    const temp = Math.round((fov - this.config.minFov) / (this.config.maxFov - this.config.minFov) * 100);
    return temp - 2 * (temp - 50);
  }

  /**
   * @summary Converts zoom level to vertical FOV
   * @param {number} level
   * @returns {number}
   */
  zoomLevelToFov(level) {
    return this.config.maxFov + (level / 100) * (this.config.minFov - this.config.maxFov);
  }

  /**
   * @summary Convert vertical FOV to horizontal FOV
   * @param {number} vFov
   * @returns {number}
   */
  vFovToHFov(vFov) {
    return THREE.Math.radToDeg(2 * Math.atan(Math.tan(THREE.Math.degToRad(vFov) / 2) * this.prop.aspect));
  }

  /**
   * @summary Converts a speed into a duration from current position to a new position
   * @param {string|number} value
   * @param {PhotoSphereViewer.Position} position
   * @returns {number}
   */
  speedToDuration(value, position) {
    if (!value || typeof value !== 'number') {
      // desired radial speed
      const speed = value ? parseSpeed(value) : this.config.animSpeed;
      // get the angle between current position and target
      const angle = getAngle(this.prop.position, position);
      // compute duration
      return angle / speed * 1000;
    }
    else {
      return value;
    }
  }

  /**
   * @summary Converts pixel texture coordinates to spherical radians coordinates
   * @param {PhotoSphereViewer.Point} point
   * @returns {PhotoSphereViewer.Position}
   */
  textureCoordsToSphericalCoords(point) {
    if (this.prop.isCubemap) {
      throw new PSVError('Unable to use texture coords with cubemap.');
    }

    const panoData = this.prop.panoData;
    const relativeX = (point.x + panoData.croppedX) / panoData.fullWidth * Math.PI * 2;
    const relativeY = (point.y + panoData.croppedY) / panoData.fullHeight * Math.PI;

    return {
      longitude: relativeX >= Math.PI ? relativeX - Math.PI : relativeX + Math.PI,
      latitude : Math.PI / 2 - relativeY,
    };
  }

  /**
   * @summary Converts spherical radians coordinates to pixel texture coordinates
   * @param {PhotoSphereViewer.Position} position
   * @returns {PhotoSphereViewer.Point}
   */
  sphericalCoordsToTextureCoords(position) {
    if (this.prop.isCubemap) {
      throw new PSVError('Unable to use texture coords with cubemap.');
    }

    const panoData = this.prop.panoData;
    const relativeLong = position.longitude / Math.PI / 2 * panoData.fullWidth;
    const relativeLat = position.latitude / Math.PI * panoData.fullHeight;

    return {
      x: Math.round(position.longitude < Math.PI ? relativeLong + panoData.fullWidth / 2 : relativeLong - panoData.fullWidth / 2) - panoData.croppedX,
      y: Math.round(panoData.fullHeight / 2 - relativeLat) - panoData.croppedY,
    };
  }

  /**
   * @summary Converts spherical radians coordinates to a THREE.Vector3
   * @param {PhotoSphereViewer.Position} position
   * @returns {external:THREE.Vector3}
   */
  sphericalCoordsToVector3(position) {
    return new THREE.Vector3(
      SPHERE_RADIUS * -Math.cos(position.latitude) * Math.sin(position.longitude),
      SPHERE_RADIUS * Math.sin(position.latitude),
      SPHERE_RADIUS * Math.cos(position.latitude) * Math.cos(position.longitude)
    );
  }

  /**
   * @summary Converts a THREE.Vector3 to spherical radians coordinates
   * @param {external:THREE.Vector3} vector
   * @returns {PhotoSphereViewer.Position}
   */
  vector3ToSphericalCoords(vector) {
    const phi = Math.acos(vector.y / Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z));
    const theta = Math.atan2(vector.x, vector.z);

    return {
      longitude: theta < 0 ? -theta : Math.PI * 2 - theta,
      latitude : Math.PI / 2 - phi,
    };
  }

  /**
   * @summary Converts position on the viewer to a THREE.Vector3
   * @param {PhotoSphereViewer.Point} viewerPoint
   * @returns {external:THREE.Vector3}
   */
  viewerCoordsToVector3(viewerPoint) {
    const screen = new THREE.Vector2(
      2 * viewerPoint.x / this.prop.size.width - 1,
      -2 * viewerPoint.y / this.prop.size.height + 1
    );

    this.psv.renderer.raycaster.setFromCamera(screen, this.psv.renderer.camera);

    const intersects = this.psv.renderer.raycaster.intersectObjects(this.psv.renderer.scene.children);

    if (intersects.length === 1) {
      return intersects[0].point;
    }
    else {
      return null;
    }
  }

  /**
   * @summary Converts a THREE.Vector3 to position on the viewer
   * @param {external:THREE.Vector3} vector
   * @returns {PhotoSphereViewer.Point}
   */
  vector3ToViewerCoords(vector) {
    const vectorClone = vector.clone();
    vectorClone.project(this.psv.renderer.camera);

    return {
      x: Math.round((vectorClone.x + 1) / 2 * this.prop.size.width),
      y: Math.round((1 - vectorClone.y) / 2 * this.prop.size.height),
    };
  }

  /**
   * @summary Converts x/y to latitude/longitude if present and ensure boundaries
   * @param {PhotoSphereViewer.ExtendedPosition} position
   * @returns {PhotoSphereViewer.Position}
   */
  cleanPosition(position) {
    if ('x' in position && 'y' in position) {
      return this.textureCoordsToSphericalCoords(position);
    }
    else {
      return {
        longitude: parseAngle(position.longitude),
        latitude : parseAngle(position.latitude, true),
      };
    }
  }

  /**
   * @summary Apply "longitudeRange" and "latitudeRange"
   * @param {PhotoSphereViewer.Position} position
   * @returns {{rangedPosition: PhotoSphereViewer.Position, sidesReached: string[]}}
   */
  applyRanges(position) {
    const rangedPosition = {
      longitude: position.longitude,
      latitude : position.latitude,
    };
    const sidesReached = [];

    let range;
    let offset;

    if (this.config.longitudeRange) {
      range = clone(this.config.longitudeRange);
      offset = THREE.Math.degToRad(this.prop.hFov) / 2;

      range[0] = parseAngle(range[0] + offset);
      range[1] = parseAngle(range[1] - offset);

      if (range[0] > range[1]) { // when the range cross longitude 0
        if (position.longitude > range[1] && position.longitude < range[0]) {
          if (position.longitude > (range[0] / 2 + range[1] / 2)) { // detect which side we are closer too
            rangedPosition.longitude = range[0];
            sidesReached.push('left');
          }
          else {
            rangedPosition.longitude = range[1];
            sidesReached.push('right');
          }
        }
      }
      else if (position.longitude < range[0]) {
        rangedPosition.longitude = range[0];
        sidesReached.push('left');
      }
      else if (position.longitude > range[1]) {
        rangedPosition.longitude = range[1];
        sidesReached.push('right');
      }
    }

    if (this.config.latitudeRange) {
      range = clone(this.config.latitudeRange);
      offset = THREE.Math.degToRad(this.prop.vFov) / 2;

      range[0] = parseAngle(Math.min(range[0] + offset, range[1]), true);
      range[1] = parseAngle(Math.max(range[1] - offset, range[0]), true);

      if (position.latitude < range[0]) {
        rangedPosition.latitude = range[0];
        sidesReached.push('bottom');
      }
      else if (position.latitude > range[1]) {
        rangedPosition.latitude = range[1];
        sidesReached.push('top');
      }
    }

    return { rangedPosition, sidesReached };
  }

}

export { PSVDataHelper };
