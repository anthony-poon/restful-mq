const app = require("../app");
const logger = app.get("logger");
const proxy = require('http-proxy').createProxyServer();

proxy.on("error", e => logger.error(e));

module.exports = (req, res, context) => {
    proxy.web(req, res, {
        target: context.redirect_path,
        ignorePath: context.ignore_path
    });
};