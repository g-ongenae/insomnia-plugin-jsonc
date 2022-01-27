/**
 * JSON Content-Type
 */
const CONTENT_TYPE_JSON = "application/json";

/**
 * Strip comments from a JSON string
 *
 * Taken from [`json-easy-strip`](https://www.npmjs.com/package/json-easy-strip).
 *
 * Extracted to not parse and stringify again the JSON string
 *
 * @param data the JSON string with comments
 * @returns the JSON string without comments
 */
const stripJSONComments = (data) =>
  data.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
    g ? "" : m
  );

/**
 * Hook to update request body and remove comments
 * @param context insomnia request context
 * @link https://docs.insomnia.rest/insomnia/context-object-reference
 */
const updateRequestBodyHook = (context) => {
  const body = context.request.getBody();
  if (body.mimeType === CONTENT_TYPE_JSON) {
    context.request.setBody({
      ...body,
      text: stripJSONComments(body.text),
    });
  }
};

module.exports.requestHooks = [updateRequestBodyHook];
