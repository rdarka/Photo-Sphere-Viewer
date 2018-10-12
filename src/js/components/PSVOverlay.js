import { AbstractComponent } from './AbstractComponent';

/**
 * @summary Overlay class
 * @extends module:components.AbstractComponent
 * @memberof module:components
 */
class PSVOverlay extends AbstractComponent {

  /**
   * @param {PhotoSphereViewer} psv
   */
  constructor(psv) {
    super(psv, 'psv-overlay');

    /**
     * @member {Object}
     * @private
     */
    this.prop = {
      id: undefined,
    };

    /**
     * Image container
     * @member {HTMLElement}
     * @readonly
     * @private
     */
    this.image = document.createElement('div');
    this.image.className = 'psv-overlay-image';
    this.container.appendChild(this.image);

    /**
     * Text container
     * @member {HTMLElement}
     * @readonly
     * @private
     */
    this.text = document.createElement('div');
    this.text.className = 'psv-overlay-text';
    this.container.appendChild(this.text);

    /**
     * Subtext container
     * @member {HTMLElement}
     * @readonly
     * @private
     */
    this.subtext = document.createElement('div');
    this.subtext.className = 'psv-overlay-subtext';
    this.container.appendChild(this.subtext);

    this.container.addEventListener('click', () => this.hide());

    super.hide();
  }

  /**
   * @override
   */
  destroy() {
    delete this.prop;
    delete this.image;
    delete this.text;
    delete this.subtext;

    super.destroy();
  }

  /**
   * @summary Displays an overlay on the viewer
   * @param {Object|string} config
   * @param {string} [config.id]
   * @param {string} config.image
   * @param {string} config.text
   * @param {string} [config.subtext]
   *
   * @example
   * viewer.showOverlay({
   *   image: '<svg></svg>',
   *   text: '....',
   *   subtext: '....'
   * })
   */
  show(config) {
    if (typeof config === 'string') {
      config = { text: config }; // eslint-disable-line no-param-reassign
    }

    this.prop.id = config.id;
    this.image.innerHTML = config.image || '';
    this.text.innerHTML = config.text || '';
    this.subtext.innerHTML = config.subtext || '';

    super.show();

    /**
     * @event show-overlay
     * @memberof module:components.PSVOverlay
     * @summary Trigered when the overlay is shown
     * @param {string} id
     */
    this.psv.trigger('show-overlay', config.id);
  }

  /**
   * @summary Hides the notification
   * @param {string} [id]
   * @fires module:components.PSVOverlay.hide-notification
   */
  hide(id) {
    if (this.visible && (!id || this.prop.id !== id)) {
      super.hide();

      this.prop.id = undefined;

      /**
       * @event hide-overlay
       * @memberof module:components.PSVOverlay
       * @summary Trigered when the overlay is hidden
       */
      this.psv.trigger('hide-overlay');
    }
  }

}

export { PSVOverlay };
