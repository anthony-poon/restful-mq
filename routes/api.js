

module.exports = async (context) => {
    const configRouter = require('../lib/configurable-router')(context);
    const mqHandler = require('../lib/message-queue-handler')(context);
    const rpHandler = require('../lib/reverse-proxy-handler')(context);
    configRouter.setRoutes(context.config.api);
    configRouter.on("message_queue", mqHandler);
    configRouter.on("reverse_proxy", rpHandler);
    return configRouter;
};
