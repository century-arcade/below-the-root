export function basicsVisible(state, seenInput) {
  return !seenInput && !!(state.title || state.demo);
}
