const APIRouter = require("./api-router");
const MessageQueueHandler = require("./message-queue-handler");
const ReverseProxyHandler = require("./reverse-proxy-handler");

module.exports = async (context) => {
    const router = new APIRouter(context);
    const mqHandler = new MessageQueueHandler(context);
    const rpHandler = new ReverseProxyHandler(context);
    router.on("message_queue", mqHandler.middleware);
    router.on("reverse_proxy", rpHandler.middleware);
    return router.middleware;
};
