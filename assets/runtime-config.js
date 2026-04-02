(function () {
  var detectedBase = '';
  try {
    if (window.location && /^https?:/.test(window.location.protocol)) {
      detectedBase = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    }
  } catch (err) {
    detectedBase = '';
  }

  window.ACS_RUNTIME_CONFIG = Object.assign({
    API_URL:'https://script.google.com/macros/s/AKfycbwd7VGBUVHziARpZi6qvsqvYb-VtCPUDQlcvROopyEpKk8DpkE7qckTa5c7XS6TDelm/exec',
    APP_BASE_URL: detectedBase
  }, window.ACS_RUNTIME_CONFIG || {});
})();
