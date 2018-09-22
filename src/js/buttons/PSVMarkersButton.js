import { AbstractButton } from './AbstractButton';

/**
 * @summary Navigation bar markers button class
 * @extends module:components/buttons.AbstractButton
 * @memberof module:components/buttons
 */
class PSVMarkersButton extends AbstractButton {

  static id = 'markers';
  static icon = 'pin';

  /**
   * @param {module:components.PSVNavbar} navbar
   */
  constructor(navbar) {
    super(navbar, 'psv-button--hover-scale psv-markers-button');

    this.psv.on('open-panel', this);
    this.psv.on('close-panel', this);
  }

  /**
   * @override
   */
  destroy() {
    this.psv.off('open-panel');
    this.psv.off('close-panel');

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
      case 'open-panel':  this.toggleActive(e.args[0] === 'markersList'); break;
      case 'close-panel': this.toggleActive(false); break;
      // @formatter:on
    }
    /* eslint-enable */
  }

  /**
   * @override
   * @description Toggles markers list
   */
  __onClick() {
    this.psv.hud.toggleMarkersList();
  }

}

export { PSVMarkersButton };
