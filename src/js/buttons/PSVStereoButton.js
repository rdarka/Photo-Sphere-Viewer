import { SYSTEM } from '../data/system';
import { AbstractButton } from './AbstractButton';

/**
 * @summary Navigation bar gyroscope button class
 * @extends module:components/buttons.AbstractButton
 * @memberof module:components/buttons
 */
class PSVStereoButton extends AbstractButton {

  static id = 'stereo';
  static icon = 'stereo';

  /**
   * @param {module:components.PSVNavbar} navbar
   */
  constructor(navbar) {
    super(navbar, 'psv-button--hover-scale psv-stereo-button');

    this.psv.on('stereo-updated', this);
  }

  /**
   * @override
   */
  destroy() {
    this.psv.off('stereo-updated', this);

    super.destroy();
  }

  /**
   * @override
   */
  supported() {
    if (!SYSTEM.fullscreenEvent || !SYSTEM.checkTHREE('DeviceOrientationControls')) {
      return false;
    }
    else {
      return SYSTEM.isDeviceOrientationSupported;
    }
  }

  /**
   * @summary Handles events
   * @param {Event} e
   * @private
   */
  handleEvent(e) {
    /* eslint-disable */
    switch (e.type) {
      // @formatter:off
      case 'stereo-updated': this.toggleActive(e.args[0]); break;
      // @formatter:on
    }
    /* eslint-enable */
  }

  /**
   * @override
   * @description Toggles gyroscope control
   */
  __onClick() {
    this.psv.toggleStereoView();
  }

}

export { PSVStereoButton };
