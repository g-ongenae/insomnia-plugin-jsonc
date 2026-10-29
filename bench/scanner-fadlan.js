/**
 * Character scanner from `insomnia-plugin-json-comments-fadlan` (MIT), copied as is for benchmarking
 *
 * @link https://github.com/mfadlanabdillah/insomnia-plugin-json-comments-fadlan/blob/9aa5107662580630c240e3aed08068209fb26d5d/main.js
 */
function stripJsonComments(jsonString) {
  let insideString = false;
  let result = '';
  let i = 0;

  while (i < jsonString.length) {
    const ch = jsonString[i];
    const next = jsonString[i + 1];

    if (!insideString) {
      if (ch === '/' && next === '/') {
        while (i < jsonString.length && jsonString[i] !== '\n') {
          i++;
        }
        continue;
      }

      if (ch === '/' && next === '*') {
        i += 2;
        while (i < jsonString.length && !(jsonString[i] === '*' && jsonString[i + 1] === '/')) {
          i++;
        }
        i += 2;
        continue;
      }

      if (ch === ',' && next && next !== '{' && next !== '[') {
        let j = i + 1;
        while (j < jsonString.length && (jsonString[j] === ' ' || jsonString[j] === '\n' || jsonString[j] === '\r' || jsonString[j] === '\t')) {
          j++;
        }
        if (jsonString[j] === '}' || jsonString[j] === ']') {
          result += ' ';
          i++;
          continue;
        }
      }
    }

    if (ch === '"' && jsonString[i - 1] !== '\\') {
      insideString = !insideString;
    }

    result += ch;
    i++;
  }

  return result;
}

module.exports = { stripJSONC: stripJsonComments };
