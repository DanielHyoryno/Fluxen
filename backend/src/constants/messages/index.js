const id = require("./id");
const en = require("./en");

const BACKEND_LOCALE = process.env.BACKEND_LOCALE || "en";

module.exports = BACKEND_LOCALE.toLowerCase() === "id" ? id : en;
