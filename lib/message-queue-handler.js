const uniqid = require('uniqid');
const moment = require("moment");
const ApplicationContext = require("./application-context");
const jwt = require("jsonwebtoken");
const axios = require("axios");

class MessageQueueHandler extends ApplicationContext{
    constructor(context = {}) {
        super(context);

        this.middleware = async (req, res, context) => {
            const channel = this.amqpChannel;
            const jwtSecret = this.config.jwtSecret;
            const replyQueue = this.config.replyQueue;
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
                    reply_to: replyQueue
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
                const response = await axios.get(url, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                res
                    .set("Content-Type", response.headers["content-type"])
                    .send(response.data);
            }
        };
        this.middleware.bind(this);
    }
}

module.exports = MessageQueueHandler;