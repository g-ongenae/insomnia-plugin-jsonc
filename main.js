const { stripJSONC } = require("./strip");

/**
 * JSON Content-Type
 */
const CONTENT_TYPE_JSON = "application/json";

/**
 * Check if a MIME type is JSON, ignoring its parameters
 *
 * Matches `application/json` and structured syntax suffixes like `application/vnd.api+json`.
 *
 * @param mimeType the MIME type, possibly with parameters (`application/json; charset=utf-8`)
 * @returns whether the MIME type is JSON
 */
const isJSONMimeType = (mimeType) => {
  const type = String(mimeType ?? "").split(";")[0].trim().toLowerCase();
  return type === CONTENT_TYPE_JSON || type.endsWith("+json");
};

/**
 * Hook to update request body and remove comments and trailing commas
 * @param context insomnia request context
 * @link https://docs.insomnia.rest/insomnia/context-object-reference
 */
const updateRequestBodyHook = (context) => {
  const body = context.request.getBody();
  // `text` is undefined on an empty body
  if (isJSONMimeType(body.mimeType) && typeof body.text === "string") {
    context.request.setBody({
      ...body,
      text: stripJSONC(body.text),
    });
  }
};

module.exports.requestHooks = [updateRequestBodyHook];
