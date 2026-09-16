// Temporary live controls; values intentionally reset on reload.
export function setupMusicTuning(staff) {
  const settings = { lifetime: 2.4 };
  const panel = document.createElement('details');
  panel.id = 'music-tuning';
  panel.open = true;
  panel.innerHTML = `<summary>Music tuning (temporary)</summary>
    <label>Travel time <input type="range" min="1" max="6" step="0.1" value="2.4" data-setting="lifetime"> <output>2.4 s</output></label>
    <small>Higher = slower, closer notes.</small>
    <label>Extra bar gap <input type="range" min="0" max="32" step="1" value="12" data-setting="gap"> <output>12 px</output></label>
    <button type="button">Reset</button>`;
  const lifetime = panel.querySelector('[data-setting="lifetime"]');
  const gap = panel.querySelector('[data-setting="gap"]');
  function update() {
    settings.lifetime = Number(lifetime.value);
    lifetime.nextElementSibling.value = `${lifetime.value} s`;
    gap.nextElementSibling.value = `${gap.value} px`;
    staff.style.setProperty('--measure-gap', `${gap.value}px`);
  }
  panel.addEventListener('input', update);
  panel.querySelector('button').addEventListener('click', () => {
    lifetime.value = '2.4';
    gap.value = '12';
    update();
  });
  for (const type of ['keydown', 'keyup']) panel.addEventListener(type, event => event.stopPropagation());
  document.body.append(panel);
  return settings;
}
