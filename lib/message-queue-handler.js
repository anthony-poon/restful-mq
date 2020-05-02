const app = require("../app");
const uniqid = require('uniqid');
const moment = require("moment");
const jwt = require("jsonwebtoken");

const channel = app.get("amqp_channel");
const config = app.get("config");
const jwtSecret = config["__APP__"]["jwt_secret"];

module.exports = async (req, res, context) => {
    const isAsync = !!req.query["async"];
    const allowCache = isAsync && !!req.query["cache"];
    const timestamp = moment();
    const ticketExp = isAsync ? timestamp.add(1, "days") : timestamp.add(2, "minutes");

    await channel.assertQueue(context["queue_name"], {
        durable: false
    });

    const ticketId = uniqid();
    // If it is an async query, issue a token valid for 2 min, otherwise 1 day
    const token = jwt.sign({
        exp: ticketExp.unix(),
        allowCache,
        ticketId
    }, jwtSecret);

    channel.sendToQueue(context["queue_name"], Buffer.from(JSON.stringify({
        request: {
            "url": req.url,
            "body": req.body,
            "hostname": req.hostname,
            "ip": req.ip,
            "headers": req.headers
        },
        ticket: {
            id: ticketId,
            timestamp: timestamp.format(),
            reply_to: config.tickets.queue_name
        }
    })));

    res.json({
        "ticket_id": ticketId,
        "timestamp": timestamp.format(),
        "expire_on": ticketExp.unix(),
        "jwt_token": token
    });
};