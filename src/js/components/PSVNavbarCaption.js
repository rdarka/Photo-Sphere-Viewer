import { PSVCaptionButton } from '../buttons/PSVCaptionButton';
import { getStyle } from '../utils';
import { AbstractComponent } from './AbstractComponent';

/**
 * @summary Navbar caption class
 * @extends module:components.AbstractComponent
 * @memberof module:components
 */
class PSVNavbarCaption extends AbstractComponent {

  /**
   * @param {module:components.PSVNavbar} navbar
   * @param {string} caption
   */
  constructor(navbar, caption) {
    super(navbar, 'psv-caption');

    /**
     * @member {Object}
     * @private
     */
    this.prop = {
      caption: '',
      width  : 0,
    };

    /**
     * @member {module:components/buttons.PSVCaptionButton}
     * @readonly
     * @private
     */
    this.button = new PSVCaptionButton(this);
    this.button.hide();

    /**
     * @member {HTMLElement}
     * @readonly
     * @private
     */
    this.content = document.createElement('div');
    this.content.className = 'psv-caption-content';
    this.container.appendChild(this.content);

    this.psv.on('size-updated', this);

    this.setCaption(caption);
  }

  /**
   * @override
   */
  destroy() {
    this.psv.off('size-updated', this);

    this.button.destroy();

    delete this.button;
    delete this.content;

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
      case 'size-updated': this.__onResize(); break;
      // @formatter:on
    }
    /* eslint-enable */
  }

  /**
   * @summary Sets the bar caption
   * @param {string} html
   */
  setCaption(html) {
    this.prop.caption = html || '';

    this.content.innerHTML = this.prop.caption;

    this.content.style.display = '';
    this.prop.width = this.content.offsetWidth;

    this.__onResize();
  }

  /**
   * @summary Toggles content and icon deending on available space
   * @private
   */
  __onResize() {
    const width = +getStyle(this.container, 'width'); // get real inner width

    if (width >= this.prop.width) {
      this.button.hide();
      this.content.style.display = '';
    }
    else {
      this.button.show();
      this.content.style.display = 'none';
    }
  }

}

export { PSVNavbarCaption };
