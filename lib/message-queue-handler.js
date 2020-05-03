const uniqid = require('uniqid');
const moment = require("moment");
const jwt = require("jsonwebtoken");

module.exports = (context) => {
    const config = context.config;
    const jwtSecret = config.jwtSecret;
    const channel = context.amqpChannel;
    const proxy = context.proxy;

    const handler = async (req, res, context) => {
        const isAsync = !!req.query["async"];
        const timestamp = moment();
        const ticketExp = isAsync ? timestamp.add(1, "days") : timestamp.add(2, "minutes");

        await channel.assertQueue(context["queue_name"], {
            durable: false
        });

        const ticketId = uniqid();
        // If it is an async query, issue a token valid for 2 min, otherwise 1 day
        const token = jwt.sign({
            exp: ticketExp.unix(),
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
                reply_to: config.replyQueue
            }
        })));

        if (isAsync) {
            res.json({
                "ticket_id": ticketId,
                "timestamp": timestamp.format(),
                "expire_on": ticketExp.unix(),
                "jwt_token": token
            });
        } else {
            const url =
                req.protocol + "://" + req.get("host") + "/tickets/" + ticketId;
            req.headers["Authorization"] = "Bearer " + token;
            proxy.web(req, res, {
                target: url,
                ignorePath: true
            })
        }
    };

    return handler;
};