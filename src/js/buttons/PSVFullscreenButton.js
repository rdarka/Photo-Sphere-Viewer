import { SYSTEM } from '../data/system';
import { AbstractButton } from './AbstractButton';

/**
 * @summary Navigation bar fullscreen button class
 * @extends module:components/buttons.AbstractButton
 * @memberof module:components/buttons
 */
class PSVFullscreenButton extends AbstractButton {

  static id = 'fullscreen';
  static icon = 'fullscreenIn';
  static iconActive = 'fullscreenOut';

  /**
   * @param {module:components.PSVNavbar} navbar
   */
  constructor(navbar) {
    super(navbar, 'psv-button--hover-scale psv-fullscreen-button');

    this.psv.on('fullscreen-updated', this);
  }

  /**
   * @override
   */
  destroy() {
    this.psv.off('fullscreen-updated', this);

    super.destroy();
  }

  /**
   * @override
   */
  supported() {
    return !!SYSTEM.fullscreenEvent;
  }

  /**
   * Handle events
   * @param {Event} e
   * @private
   */
  handleEvent(e) {
    /* eslint-disable */
    switch (e.type) {
      // @formatter:off
      case 'fullscreen-updated': this.toggleActive(e.args[0]); break;
      // @formatter:on
    }
    /* eslint-enable */
  }

  /**
   * @override
   * @description Toggles fullscreen
   */
  __onClick() {
    this.psv.toggleFullscreen();
  }

}

export { PSVFullscreenButton };
