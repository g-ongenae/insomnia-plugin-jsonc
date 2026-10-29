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
  if (body.mimeType === CONTENT_TYPE_JSON) {
    context.request.setBody({
      ...body,
      text: stripJSONComments(body.text),
    });
  }
};

module.exports.requestHooks = [updateRequestBodyHook];
