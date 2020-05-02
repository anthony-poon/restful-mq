const app = require("../app");
const configRouter = require('../lib/configurable-router');
const mqHandler = require('../lib/message-queue-handler');
const rpHandler = require('../lib/reverse-proxy-handler');
const config = app.get("config");

configRouter.setRoutes(config.api);
configRouter.on("message_queue", mqHandler);
configRouter.on("reverse_proxy", rpHandler);

module.exports = configRouter;
