import * as THREE from 'three';
import { CUBE_VERTICES, SPHERE_RADIUS, SPHERE_VERTICES } from '../data/constants';
import { SYSTEM } from '../data/system';
import { PSVAnimation } from '../PSVAnimation';
import { cleanTHREEScene } from '../utils';
import { AbstractService } from './AbstractService';

/**
 * @summary Viewer and renderer
 * @extends module:services.AbstractService
 * @memberof module:services
 */
class PSVRenderer extends AbstractService {

  /**
   * @param {PhotoSphereViewer} psv
   */
  constructor(psv) {
    super(psv);

    /**
     * @member {number}
     * @private
     */
    this.mainReqid = undefined;

    /**
     * @member {HTMLElement}
     * @readonly
     * @protected
     */
    this.canvasContainer = null;

    /**
     * @member {external:THREE.WebGLRenderer | external:THREE.CanvasRenderer}
     * @readonly
     * @protected
     */
    this.renderer = null;

    /**
     * @member {external:THREE.StereoEffect}
     * @protected
     */
    this.stereoEffect = null;

    /**
     * @member {external:THREE.Scene}
     * @readonly
     * @protected
     */
    this.scene = null;

    /**
     * @member {external:THREE.PerspectiveCamera}
     * @readonly
     * @protected
     */
    this.camera = null;

    /**
     * @member {external:THREE.Mesh}
     * @readonly
     * @protected
     */
    this.mesh = null;

    /**
     * @member {external:THREE.Raycaster}
     * @readonly
     * @protected
     */
    this.raycaster = null;

    /**
     * @member {external:THREE.DeviceOrientationControls}
     * @readonly
     * @protected
     */
    this.doControls = null;

    psv.on('size-updated', (size) => {
      if (this.renderer) {
        (this.stereoEffect || this.renderer).setSize(size.width, size.height);
      }
    });
  }

  /**
   * @override
   */
  destroy() {
    // cancel render loop
    if (this.mainReqid) {
      window.cancelAnimationFrame(this.mainReqid);
    }

    // destroy ThreeJS view
    if (this.scene) {
      cleanTHREEScene(this.scene);
    }

    // remove container
    if (this.canvasContainer) {
      this.psv.container.removeChild(this.canvasContainer);
    }

    delete this.canvasContainer;
    delete this.renderer;
    delete this.stereoEffect;
    delete this.scene;
    delete this.camera;
    delete this.mesh;
    delete this.raycaster;
    delete this.doControls;

    super.destroy();
  }

  /**
   * @summary Hides the viewer
   */
  hide() {
    if (this.canvasContainer) {
      this.canvasContainer.style.opacity = 0;
    }
  }

  /**
   * @summary Shows the viewer
   */
  show() {
    if (this.canvasContainer) {
      this.canvasContainer.style.opacity = 1;
    }
  }

  /**
   * @summary Main event loop, calls {@link render} if `prop.needsUpdate` is true
   * @param {number} timestamp
   * @fires module:services.PSVRenderer.before-render
   * @private
   */
  __renderLoop(timestamp) {
    /**
     * @event before-render
     * @memberof module:services.PSVRenderer
     * @summary Triggered before a render, used to modify the view
     * @param {number} timestamp - time provided by requestAnimationFrame
     */
    this.psv.trigger('before-render', timestamp);

    if (this.prop.needsUpdate) {
      this.render();
      this.prop.needsUpdate = false;
    }

    this.mainReqid = window.requestAnimationFrame(t => this.__renderLoop(t));
  }

  /**
   * @summary Performs a render
   * @description Do not call this method directly, instead call
   * {@link PhotoSphereViewer#needsUpdate} on {@link module:services.PSVRenderer.event:before-render}.
   * @fires module:services.PSVRenderer.render
   */
  render() {
    this.prop.direction = this.psv.dataHelper.sphericalCoordsToVector3(this.prop.position);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(this.prop.direction);

    if (this.config.fisheye) {
      this.camera.position.copy(this.prop.direction).multiplyScalar(this.config.fisheye / 2).negate();
    }

    this.camera.aspect = this.prop.aspect;
    this.camera.fov = this.prop.vFov;
    this.camera.updateProjectionMatrix();

    (this.stereoEffect || this.renderer).render(this.scene, this.camera);

    /**
     * @event render
     * @memberof module:services.PSVRenderer
     * @summary Triggered on each viewer render, **this event is triggered very often**
     */
    this.psv.trigger('render');
  }

  /**
   * @summary Applies the texture to the scene, creates the scene if needed
   * @param {external:THREE.Texture|external:THREE.Texture[]} texture
   * @fires module:services.PSVRenderer.panorama-loaded
   * @package
   */
  setTexture(texture) {
    if (!this.scene) {
      this.__createScene();
    }

    if (this.prop.isCubemap) {
      for (let i = 0; i < 6; i++) {
        if (this.mesh.material[i].map) {
          this.mesh.material[i].map.dispose();
        }

        this.mesh.material[i].map = texture[i];
      }
    }
    else {
      if (this.mesh.material.map) {
        this.mesh.material.map.dispose();
      }

      this.mesh.material.map = texture;
    }

    /**
     * @event panorama-loaded
     * @memberof module:services.PSVRenderer
     * @summary Triggered when a panorama image has been loaded
     */
    this.psv.trigger('panorama-loaded');

    if (!this.mainReqid) {
      this.__renderLoop(+new Date());
    }
  }

  /**
   * @summary Creates the 3D scene and GUI components
   * @private
   */
  __createScene() {
    this.raycaster = new THREE.Raycaster();

    this.renderer = SYSTEM.isWebGLSupported && this.config.webgl ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer();
    this.renderer.setSize(this.prop.size.width, this.prop.size.height);
    this.renderer.setPixelRatio(SYSTEM.pixelRatio);

    let cameraDistance = SPHERE_RADIUS;
    if (this.prop.isCubemap) {
      cameraDistance *= Math.sqrt(3);
    }
    if (this.config.fisheye) {
      cameraDistance += SPHERE_RADIUS;
    }

    this.camera = new THREE.PerspectiveCamera(this.config.defaultFov, this.prop.size.width / this.prop.size.height, 1, cameraDistance);
    this.camera.position.set(0, 0, 0);

    this.scene = new THREE.Scene();
    this.scene.add(this.camera);

    if (this.prop.isCubemap) {
      this.mesh = this.__createCubemap();
    }
    else {
      this.mesh = this.__createSphere();
    }

    this.scene.add(this.mesh);

    // create canvas container
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'psv-canvas-container';
    this.renderer.domElement.className = 'psv-canvas';
    this.psv.container.appendChild(this.canvasContainer);
    this.canvasContainer.appendChild(this.renderer.domElement);
  }

  /**
   * @summary Creates the sphere mesh
   * @param {number} [scale=1]
   * @returns {external:THREE.Mesh}
   * @private
   */
  __createSphere(scale = 1) {
    // The middle of the panorama is placed at longitude=0
    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS * scale, SPHERE_VERTICES, SPHERE_VERTICES, -Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      side    : THREE.DoubleSide, // needs to be DoubleSide for CanvasRenderer
      overdraw: SYSTEM.isWebGLSupported && this.config.webgl ? 0 : 1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.x = -1;
    mesh.rotation.x = this.config.sphereCorrection.tilt;
    mesh.rotation.y = this.config.sphereCorrection.pan;
    mesh.rotation.z = this.config.sphereCorrection.roll;

    return mesh;
  }

  /**
   * @summary Creates the cube mesh
   * @param {number} [scale=1]
   * @returns {external:THREE.Mesh}
   * @private
   */
  __createCubemap(scale = 1) {
    const cubeSize = SPHERE_RADIUS * 2 * scale;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize, CUBE_VERTICES, CUBE_VERTICES, CUBE_VERTICES);

    const materials = [];
    for (let i = 0; i < 6; i++) {
      materials.push(new THREE.MeshBasicMaterial({
        side    : THREE.BackSide,
        overdraw: SYSTEM.isWebGLSupported && this.config.webgl ? 0 : 1,
      }));
    }

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.x -= SPHERE_RADIUS * scale;
    mesh.position.y -= SPHERE_RADIUS * scale;
    mesh.position.z -= SPHERE_RADIUS * scale;
    mesh.applyMatrix(new THREE.Matrix4().makeScale(1, 1, -1));

    return mesh;
  }

  /**
   * @summary Performs transition between the current and a new texture
   * @param {external:THREE.Texture} texture
   * @param {PhotoSphereViewer.Position} [position]
   * @returns {PSVAnimation}
   * @package
   */
  transition(texture, position) {
    let mesh;

    if (this.prop.isCubemap) {
      if (position) {
        console.warn('PhotoSphereViewer: cannot perform cubemap transition to different position.');
        position = undefined; // eslint-disable-line no-param-reassign
      }

      mesh = this.__createCubemap(0.9);

      mesh.material.forEach((material, i) => {
        material.map = texture[i];
        material.transparent = true;
        material.opacity = 0;
      });
    }
    else {
      mesh = this.__createSphere(0.9);

      mesh.material.map = texture;
      mesh.material.transparent = true;
      mesh.material.opacity = 0;
    }

    // rotate the new sphere to make the target position face the camera
    if (position) {
      // Longitude rotation along the vertical axis
      mesh.rotateY(position.longitude - this.prop.position.longitude);

      // Latitude rotation along the camera horizontal axis
      const axis = new THREE.Vector3(0, 1, 0).cross(this.camera.getWorldDirection()).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, position.latitude - this.prop.position.latitude);
      mesh.quaternion.multiplyQuaternions(q, mesh.quaternion);

      // TODO: find a better way to handle ranges
      if (this.config.latitude_range || this.config.longitude_range) {
        this.config.longitude_range = null;
        this.config.latitude_range = null;
        console.warn('PhotoSphereViewer: trying to perform transition with longitude_range and/or latitude_range, ranges cleared.');
      }
    }

    this.scene.add(mesh);
    this.psv.needsUpdate();

    return new PSVAnimation({
      properties: {
        opacity: { start: 0.0, end: 1.0 },
      },
      duration  : this.config.transition.duration,
      easing    : 'outCubic',
      onTick    : (properties) => {
        if (this.prop.isCubemap) {
          for (let i = 0; i < 6; i++) {
            mesh.material[i].opacity = properties.opacity;
          }
        }
        else {
          mesh.material.opacity = properties.opacity;
        }

        this.psv.needsUpdate();
      },
    })
      .then(() => {
        // remove temp sphere and transfer the texture to the main sphere
        this.setTexture(texture);
        this.scene.remove(mesh);

        mesh.geometry.dispose();
        mesh.geometry = null;

        // actually rotate the camera
        if (position) {
          this.psv.rotate(position);
        }
      });
  }

  /**
   * @summary Reverses autorotate direction with smooth transition
   * @package
   */
  reverseAutorotate() {
    const newSpeed = -this.config.animSpeed;
    const range = this.config.longitudeRange;
    this.config.longitudeRange = null;

    new PSVAnimation({
      properties: {
        speed: { start: this.config.animSpeed, end: 0 },
      },
      duration  : 300,
      easing    : 'inSine',
      onTick    : (properties) => {
        this.config.animSpeed = properties.speed;
      },
    })
      .then(() => new PSVAnimation({
        properties: {
          speed: { start: 0, end: newSpeed },
        },
        duration  : 300,
        easing    : 'outSine',
        onTick    : (properties) => {
          this.config.animSpeed = properties.speed;
        },
      }))
      .then(() => {
        this.config.longitudeRange = range;
        this.config.animSpeed = newSpeed;
      });
  }

  /**
   * @summary Attaches the {@link DeviceOrientationControls} to the camera
   * @package
   */
  startGyroscopeControl() {
    this.doControls = new THREE.DeviceOrientationControls(this.camera);

    // compute the alpha offset to keep the current orientation
    this.doControls.alphaOffset = this.prop.position.longitude;
    this.doControls.update();

    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const sphericalDirection = this.psv.dataHelper.vector3ToSphericalCoords(direction);

    this.prop.gyroAlphaOffset = sphericalDirection.longitude;

    this.prop.orientationCb = () => {
      this.doControls.alphaOffset = this.prop.gyroAlphaOffset;
      this.doControls.update();

      this.camera.getWorldDirection(this.prop.direction);
      this.prop.direction.multiplyScalar(SPHERE_RADIUS);

      const sphericalCoords = this.psv.dataHelper.vector3ToSphericalCoords(this.prop.direction);
      this.prop.position.longitude = sphericalCoords.longitude;
      this.prop.position.latitude = sphericalCoords.latitude;
      this.needsUpdate();
    };

    this.psv.on('before-render', this.prop.orientationCb);
  }

  /**
   * @summary Destroys the {@link DeviceOrientationControls}
   * @package
   */
  stopGyroscopeControl() {
    this.psv.off('before-render', this.prop.orientationCb);
    this.prop.orientationCb = null;

    this.doControls.disconnect();
    this.doControls = null;
  }

  /**
   * @summary Attaches the {@link StereoEffect} to the renderer
   * @package
   */
  startStereoView() {
    this.stereoEffect = new THREE.StereoEffect(this.renderer);
  }

  /**
   * @summary Destroys the {@link StereoEffect}
   * @package
   */
  stopStereoView() {
    this.stereoEffect = null;
  }

}

export { PSVRenderer };
