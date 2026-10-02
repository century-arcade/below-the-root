export function setupManual(root) {
  const image = root.querySelector('img');
  const link = root.querySelector('[data-manual-image]');
  const select = root.querySelector('select');
  const previous = root.querySelector('[data-manual-previous]');
  const next = root.querySelector('[data-manual-next]');
  const status = root.querySelector('output');
  const count = 20;
  let current = 1;
  for (let page = 1; page <= count; page++) {
    const option = document.createElement('option');
    option.value = String(page);
    option.textContent = String(page);
    select.append(option);
  }
  function show(page) {
    current = Math.max(1, Math.min(count, page));
    const url = `/assets/manual/${String(current).padStart(2, '0')}.webp`;
    image.src = url;
    image.alt = `Original Below the Root manual, scan ${current} of ${count}`;
    link.href = url;
    select.value = String(current);
    previous.disabled = current === 1;
    next.disabled = current === count;
    status.textContent = `${current} / ${count}`;
  }
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  select.addEventListener('change', () => show(Number(select.value)));
  for (const type of ['keydown', 'keyup']) {
    root.addEventListener(type, event => event.stopPropagation());
  }
  show(current);
}
