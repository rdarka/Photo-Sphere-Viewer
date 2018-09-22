/**
 * @summary Markers list template
 * @param {PSVMarker[]} markers
 * @param {PhotoSphereViewer} psv
 * @returns {string}
 */
export default (markers, psv) => `
<div class="psv-markers-list-container">
  <h1 class="psv-markers-list-title">${psv.config.lang.markers}</h1>
  <ul class="psv-markers-list">
    ${markers.forEach(marker => `
    <li data-psv-marker="${marker.id}" class="psv-markers-list-item ${marker.className || ''}">
      ${marker.image ? `<img class="psv-markers-list-image" src="${marker.image}"/>` : ''}
      <p class="psv-markers-list-name">${marker.tooltip ? marker.tooltip.content : marker.html || marker.id}</p>
    </li>
    `)}$
  </ul>
</div>
`;
