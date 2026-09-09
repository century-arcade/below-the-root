export const LOG_MS = 10000;

function stamp(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(value => String(value).padStart(2, '0')).join(':');
}

export function createLog(element, {
  onToggle = () => {}, now = () => new Date(), setTimer = setTimeout, ms = LOG_MS,
} = {}) {
  return function log(text) {
    console.log(text);
    const wasHidden = element.hidden;
    const line = element.ownerDocument.createElement('div');
    line.textContent = `${stamp(now())} ${text}`;
    element.append(line);
    element.hidden = false;
    if (wasHidden) onToggle();
    element.scrollTop = element.scrollHeight;
    setTimer(() => {
      line.remove();
      if (element.childElementCount) return;
      element.hidden = true;
      onToggle();
    }, ms);
  };
}
