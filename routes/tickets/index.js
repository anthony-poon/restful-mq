const TicketRouter = require("./ticket-router");
module.exports = async (context) => {
    const tRouter = new TicketRouter(context);
    return tRouter.middleware;
};