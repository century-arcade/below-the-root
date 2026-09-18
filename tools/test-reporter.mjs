import { inspect } from 'node:util';

export default async function* report(source) {
  for await (const { type, data } of source) {
    if (type === 'test:pass' || type === 'test:fail') {
      const status = data.skip ? 'skip' : data.todo ? 'todo' : type === 'test:pass' ? 'pass' : 'fail';
      const reason = data.skip || data.todo;
      yield `${status}: ${data.name}${typeof reason === 'string' ? ` (${reason})` : ''}\n`;
      if (type === 'test:fail') {
        yield inspect(data.details.error, { colors: false, depth: null, maxArrayLength: null, maxStringLength: null }) + '\n';
      }
    } else if (type === 'test:stdout' || type === 'test:stderr') {
      yield data.message;
    }
  }
}
