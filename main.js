const { stripJSONComments } = require("./strip");

/**
 * JSON Content-Type
 */
const CONTENT_TYPE_JSON = "application/json";

/**
 * Hook to update request body and remove comments
 * @param context insomnia request context
 * @link https://docs.insomnia.rest/insomnia/context-object-reference
 */
const updateRequestBodyHook = (context) => {
  const body = context.request.getBody();
  // `text` is undefined on an empty body
  if (body.mimeType === CONTENT_TYPE_JSON && typeof body.text === "string") {
    context.request.setBody({
      ...body,
      text: stripJSONComments(body.text),
    });
  }
};

module.exports.requestHooks = [updateRequestBodyHook];
