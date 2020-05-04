"use strict";
const winston = require('winston');
const logLevel = [
    "error",
    "warning",
    "info",
    "debug",
].includes(process.env.LOG_LEVEL.toString().toLowerCase()) ? process.env.LOG_LEVEL : "warning";
const loggerFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `[WORKER][${timestamp}][${level.toUpperCase()}]:\t${message}`;
});
const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        loggerFormat
    ),
    transports: [ new winston.transports.Console() ]
});

logger.info("Logger initialized. Log level: " + logLevel.toUpperCase());

const amqp = require('amqplib');
const inputQueue = process.env.INPUT_QUEUE;
const moment = require("moment");
const mock_delay = parseInt(process.env.MOCK_DELAY) || 5000;
const worker = {

    async start() {
        this.conn = await amqp.connect('amqp://localhost');
        this.channel = await this.conn.createChannel();
        await this.channel.assertQueue(inputQueue, {
            durable: false
        });
        this.channel.consume(inputQueue, async (msg) => {
            logger.info("Message received.");
            logger.debug("Message: " + msg.content.toString());
            const payload = JSON.parse(msg.content.toString());
            const ticket = payload.ticket;
            if (!ticket || !ticket.reply_to || !ticket.id) {
                logger.warning("Invalid message. Message dropped");
            }
            await this.channel.assertQueue(ticket.reply_to, {
                durable: false
            });

            const reply = {
                id: ticket.id,
                response: {
                    received: moment().format(),
                    ...payload
                }

            };
            setTimeout(() => {
                reply["response"]["completed"] = moment().format();
                this.channel.sendToQueue(ticket.reply_to, Buffer.from(JSON.stringify(reply)));
                logger.info("Reply sent");
            }, mock_delay);
        }, {
            noAck: true
        });
    },

    async stop() {
        if (!this.channel || !this.conn) {
            throw new Error("Cannot stop a worker that have not started yet");
        }
        await this.channel.close();
        await this.conn.close();
    }
};

if (require.main === module) {
    worker.start();
} else {
    module.exports = worker;
}


