import { SYSTEM } from '../data/system';
import { AbstractButton } from './AbstractButton';

/**
 * @summary Navigation bar gyroscope button class
 * @extends module:components/buttons.AbstractButton
 * @memberof module:components/buttons
 */
class PSVGyroscopeButton extends AbstractButton {

  static id = 'gyroscope';
  static icon = 'compass';

  /**
   * @param {module:components.PSVNavbar} navbar
   */
  constructor(navbar) {
    super(navbar, 'psv-button--hover-scale psv-gyroscope-button');

    this.psv.on('gyroscope-updated', this);
  }

  /**
   * @override
   */
  destroy() {
    this.psv.off('gyroscope-updated', this);

    super.destroy();
  }

  /**
   * @override
   */
  supported() {
    if (!SYSTEM.checkTHREE('DeviceOrientationControls')) {
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
      case 'gyroscope-updated': this.toggleActive(e.args[0]); break;
      // @formatter:on
    }
    /* eslint-enable */
  }

  /**
   * @override
   * @description Toggles gyroscope control
   */
  __onClick() {
    this.psv.toggleGyroscopeControl();
  }

}

export { PSVGyroscopeButton };
