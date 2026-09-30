export function startAnalytics() {
  if (location.origin !== 'https://below-the-root.netlify.app'
      || document.querySelector('script[data-goatcounter]')) return;
  // All *.saul.pw sites share one GoatCounter site; the prefix keeps BtR separate.
  globalThis.goatcounter = { ...globalThis.goatcounter, path: p => 'root.saul.pw' + p };
  const script = document.createElement('script');
  script.dataset.goatcounter = 'https://saulpw.goatcounter.com/count';
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  document.head.append(script);
}
