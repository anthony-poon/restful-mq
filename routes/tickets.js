const app = require("../app");
const router = require("express").Router();
const NodeCache = require("node-cache");
const _ = require("lodash");
const jwt = require('jsonwebtoken');

const config = app.get("config");
const logger = app.get("logger");
const channel = app.get("amqp_channel");
const queueName = config["tickets"]["queue_name"];
const jwtSecret = config["__APP__"]["jwt_secret"];

// TODO: Get from config
const replyCache = new NodeCache({
    stdTTL: 60 * 60 * 24,
    checkperiod: 30
});

const listenerCache = new NodeCache({
    stdTTL: 30,
    checkperiod: 1,
    useClones: false
});

replyCache.on("set", (key, value) => {
    if (listenerCache.has(key)) {
        const response = replyCache.get(key);
        const listener = listenerCache.get(key);
        listener.res.send(response);
    }
});

(async () => {
    await channel.assertQueue(queueName, {
        durable: false
    });
    channel.consume(queueName, (msg) => {
        logger.info("Received a ticket.");
        logger.debug("Message: " + msg.content.toString());
        const ticket = JSON.parse(msg.content.toString());
        let isValid = !!ticket.id;
        if (!isValid) {
            logger.info("Invalid reply received. Ticket missing id. Message dropped.");
        }
        isValid = isValid && !!ticket.response;
        if (!isValid) {
            logger.info("Invalid reply received. Ticket missing response. Message dropped.");
        }
        if (isValid) {
            const result = replyCache.set(ticket.id, ticket.response);
            if (!result) {
                logger.error("Unable to cache response for ticket #" + ticket.id);
            }
        }
        channel.ack(msg);
    });
})();

router.get("/:id", (req, res, next) => {
    const authHeader = req.header("Authorization");
    const match = /^Bearer (.+)$/.exec(authHeader);
    if (!match) {
        res.status(401).send();
        return;
    }
    const token = match[1];
    const decoded = jwt.decode(token);
    try {
        jwt.verify(token, jwtSecret)
    } catch (e) {
        res.status(403).send();
        return;
    }

    const ticketId = decoded["ticketId"];
    if (ticketId !== req.params.id) {
        res.status(403).send();
        return
    }

    // TODO: handle worker rejection

    if (replyCache.has(ticketId)) {
        const content = replyCache.get(ticketId);
        res.send(content).send();
    } else {
        listenerCache.set(ticketId, {
            res
        });
    }
});

router.get("/_cache", (req, res, next) => {
    const keys = replyCache.keys();
    const values = replyCache.mget(keys);
    const status = replyCache.getStats();
    res.json({
        status,
        cache: values
    });
});


module.exports = router;