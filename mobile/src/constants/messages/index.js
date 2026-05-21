import en from "./en";
import id from "./id";

const APP_LOCALE = "en";

const messages = APP_LOCALE === "id" ? id : en;

export default messages;
