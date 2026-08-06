import { json } from "../../lib/http.js";

export async function onRequestGet(context) {
  return json({
    user: context.data.currentUser
  });
}
