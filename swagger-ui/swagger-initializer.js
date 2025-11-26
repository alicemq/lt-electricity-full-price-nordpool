window.onload = function() {
  const specUrl = './api.yaml';

  //<editor-fold desc="Changeable Configuration Block">
  window.ui = SwaggerUIBundle({
    url: specUrl,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: 'StandaloneLayout',
    queryConfigEnabled: false,
  });
  //</editor-fold>
};