"use strict";
const ApplicationContext = require("../../lib/application-context");
const NodeCache = require("node-cache");

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
        await channel.assertQueue(queueName, {
            durable: false
        });
        channel.consume(queueName, (msg) => {
            logger.info("Received a reply.");
            logger.debug("Message: " + msg.content.toString());
            const reply = JSON.parse(msg.content.toString());
            let isValid = !!reply.id;
            if (!isValid) {
                logger.info("Invalid reply received. Ticket missing id. Message dropped.");
            }
            isValid = isValid && !!reply.response;
            if (!isValid) {
                logger.info("Invalid reply received. Ticket missing response. Message dropped.");
            }
            if (isValid) {
                const result = replyCache.set(reply.id, reply.response);
                if (!result) {
                    logger.error("Unable to cache response for ticket #" + reply.id);
                }
            }
            channel.ack(msg);
        });
    }

    onReply(ticketId, callback, onTimeout, timeout = 30) {
        if (this.replyCache.has(ticketId)) {
            callback(this.replyCache.take(ticketId));
        } else {
            this.listeners[ticketId] = callback;
            setTimeout(() => {
                if (!!this.listeners["ticketId"]) {
                    delete this.listeners[ticketId];
                    onTimeout();
                }
            }, timeout);
        }
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