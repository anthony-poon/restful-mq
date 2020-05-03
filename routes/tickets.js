const express = require('express');
const NodeCache = require("node-cache");
const _ = require("lodash");
const jwt = require('jsonwebtoken');
const moment = require("moment");

module.exports = async (context) => {
    const config = context.config;
    const logger = context.logger;
    const channel = context.amqpChannel;
    const queueName = config.replyQueue;
    const jwtSecret = config.jwtSecret;
    const router = express.Router();

    const replies = new NodeCache({
        stdTTL: 60 * 60 * 24,
        checkperiod: 30
    });

    const clients = new NodeCache({
        stdTTL: 30,
        checkperiod: 1,
        useClones: false
    });

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
            const result = replies.set(ticket.id, ticket.response);
            if (!result) {
                logger.error("Unable to cache response for ticket #" + ticket.id);
            }
        }
        channel.ack(msg);
    });

    replies.on("set", (key, value) => {
        if (clients.has(key)) {
            const response = replies.get(key);
            const client = clients.take(key);
            client.res.send(response);
        }
    });


    router.get("/:id", (req, res, next) => {
        const authHeader = req.header("Authorization");
        const match = /^Bearer (.+)$/.exec(authHeader);
        if (!match) {
            logger.info("Request dropped due to missing Authorization header");
            res.status(401).send();
            return;
        }
        const token = match[1];
        const decoded = jwt.decode(token);
        try {
            jwt.verify(token, jwtSecret, {
                ignoreExpiration: true
            })
        } catch (e) {
            logger.info("Request dropped due to invalid jwt token");
            res.status(403).send();
            return;
        }

        if (moment.unix(decoded.exp).isBefore(moment())) {
            logger.info("Request dropped due to jwt already expired");
            res.status(404).send();
            return;
        }

        const ticketId = decoded["ticketId"];
        if (ticketId !== req.params.id) {
            logger.info("Request dropped due to ticket id mismatch");
            res.status(403).send();
            return
        }

        // TODO: handle worker rejection

        if (replies.has(ticketId)) {
            const content = replies.get(ticketId);
            res.send(content).send();
        } else {
            clients.set(ticketId, {
                res
            });
            req.on("close", function(err) {
                if (clients.has(ticketId)) {
                    logger.info("Client was waiting for a reply but connection closed before reply was received");
                    logger.info(err);
                    clients.del(ticketId);
                }
            });
        }
    });

    router.get("/_cache", (req, res, next) => {
        const keys = replies.keys();
        const values = replies.mget(keys);
        const status = replies.getStats();
        res.json({
            status,
            cache: values
        });
    });

    return router;
};