const ConfigurableRouter = require("../lib/configurable-router");
const MessageQueueHandler = require("../lib/message-queue-handler");
const ReverseProxyHandler = require("../lib/reverse-proxy-handler");

module.exports = async (context) => {
    const router = new ConfigurableRouter(context);
    const mqHandler = new MessageQueueHandler(context);
    const rpHandler = new ReverseProxyHandler(context);
    router.on("message_queue", mqHandler.middleware);
    router.on("reverse_proxy", rpHandler.middleware);
    return router.middleware;
};
