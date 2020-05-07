"use strict";
const ApplicationContext = require("../../lib/application-context");
const NodeCache = require("node-cache");
const jwt = require("jsonwebtoken");

class ReplyListener extends ApplicationContext {
    constructor(context = {}) {
        super(context);
        // Reply from backend worker will wait for one hours
        // TODO: Make configurable
        this.replyCache = new NodeCache({
            stdTTL: 60 * 60,
            checkperiod: 30
        });

        this.replyCache.on("set", (key) => {
            const callback = this.listeners[key];
            if (callback) {
                const reply = this.replyCache.take(key);
                callback(reply);
                delete this.listeners[key];
            }
        });
        // But timeout the listener
        this.listeners = {};
    }

    async start() {
        const channel = this.amqpChannel;
        const queueName = this.config.replyQueue;
        const logger = this.logger;
        const replyCache = this.replyCache;
        const jwtSecret = this.config.jwtSecret;
        await channel.assertQueue(queueName, {
            durable: false
        });
        channel.consume(queueName, (msg) => {
            logger.info("Received a reply.");
            logger.debug("Message: " + msg.content.toString());
            const reply = JSON.parse(msg.content.toString());
            // TODO: Test nack;
            if (!reply.ticketId) {
                logger.info("Reply missing ticketId. Message dropped.");
                channel.nack(msg, false, false);
                return;
            }
            if (!reply.body) {
                logger.info("Reply missing body. Message dropped.");
                channel.nack(msg, false, false);
                return;
            }
            if (!reply.jwtToken) {
                logger.info("Reply missing jwtToken. Message dropped.");
                channel.nack(msg, false, false);
                return;
            }
            try {
                jwt.verify(reply.jwtToken, jwtSecret);
                const decodedJWT = jwt.decode(reply.jwtToken, jwtSecret);
                if (decodedJWT.ticketId !== reply.ticketId) {
                    throw new Error("Invalid access on this ticket")
                }
                channel.ack(msg);
                // TODO: reply checking and create dto for reply
                const result = replyCache.set(reply.ticketId, {
                    ...reply,
                    decodedJWT
                });
                if (!result) {
                    logger.error("Unable to cache response for ticket #" + reply.id);
                }
            } catch (e) {
                logger.info("Reply rejected due to invalid JWT");
                logger.info(e);
                channel.nack(msg, false, false);
            }
        });
    }

    wait(ticketId, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (this.replyCache.has(ticketId)) {
                resolve(this.replyCache.take(ticketId))
            } else {
                this.listeners[ticketId] = resolve;
            }
            setTimeout(() => {
                if (!!this.listeners[ticketId]) {
                    delete this.listeners[ticketId];
                    const e = new Error("Request timeout.");
                    e.statusCode = 504;
                    reject(e);
                }
            }, timeout);
        })
    }

    getStatus() {
        const keys = this.replyCache.keys();
        const values = this.replyCache.mget(keys);
        const status = this.replyCache.getStats();
        return {
            status,
            cache: values,
            listeners: this.listeners.keys
        };
    }
}

module.exports = ReplyListener;