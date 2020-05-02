"use strict";
const winston = require('winston');
const logLevel = [
    "error",
    "warning",
    "info",
    "debug",
].includes(process.env.LOG_LEVEL.toString().toLowerCase()) ? process.env.LOG_LEVEL : "warning";
const loggerFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}][${level.toUpperCase()}]: ${message}`;
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
const inputQueue = process.env.QUEUE_NAME;
const moment = require("moment");

(async () => {
    const conn = await amqp.connect('amqp://localhost');
    const channel = await conn.createChannel();
    await channel.assertQueue(inputQueue, {
        durable: false
    });
    channel.consume(inputQueue, async (msg) => {
        logger.info("Message received.");
        logger.debug("Message: " + msg.content.toString());
        const payload = JSON.parse(msg.content.toString());
        const ticket = payload.ticket;
        if (!ticket || !ticket.reply_to || !ticket.id) {
            logger.warning("Invalid message. Message dropped");
        }
        await channel.assertQueue(ticket.reply_to, {
            durable: false
        });

        const reply = {
            id: ticket.id,
            response: {
                "received": moment().format(),
            }
        };
        setTimeout(() => {
            reply["response"]["completed"] = moment().format();
            channel.sendToQueue(ticket.reply_to, Buffer.from(JSON.stringify(reply)));
            logger.info("Reply sent");
        }, 5000);
    }, {
        noAck: true
    });
})();