import en from "./en";
import id from "./id";

export const DEFAULT_LOCALE = "en";

export function getMessages(locale = DEFAULT_LOCALE) {
    return locale === "id" ? id : en;
}

const messages = getMessages(DEFAULT_LOCALE);

export default messages;
