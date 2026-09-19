export function startAnalytics() {
  if (location.origin !== 'https://below-the-root.netlify.app'
      || document.querySelector('script[data-goatcounter]')) return;
  const script = document.createElement('script');
  script.dataset.goatcounter = 'https://saulpw.goatcounter.com/count';
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  document.head.append(script);
}
