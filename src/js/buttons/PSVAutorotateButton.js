import { AbstractButton } from './AbstractButton';

/**
 * @summary Navigation bar autorotate button class
 * @extends module:components/buttons.AbstractButton
 * @memberof module:components/buttons
 */
class PSVAutorotateButton extends AbstractButton {

  static id = 'autorotate';
  static icon = 'play';
  static iconActive = 'playActive';

  /**
   * @param {module:components.PSVNavbar} navbar
   */
  constructor(navbar) {
    super(navbar, 'psv-button--hover-scale psv-autorotate-button');

    this.psv.on('autorotate', this);
  }

  /**
   * @override
   */
  destroy() {
    this.psv.off('autorotate', this);

    super.destroy();
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
      case 'autorotate': this.toggleActive(e.args[0]); break;
      // @formatter:on
    }
    /* eslint-enable */
  }

  /**
   * @override
   * @description Toggles autorotate
   */
  __onClick() {
    this.psv.toggleAutorotate();
  }

}

export { PSVAutorotateButton };
