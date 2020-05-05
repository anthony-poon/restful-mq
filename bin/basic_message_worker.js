"use strict";
const winston = require('winston');
const RestfulMQMessageListener = require("../lib/restful-mq-message-listener");

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
        const listener = new RestfulMQMessageListener({
            url: 'amqp://localhost',
            queue: inputQueue
        }, null, {
            durable: false
        });
        listener.onMessageReceived((msg, context) => {
            logger.info(JSON.stringify(msg));
            context.reply("ok");
        });
        listener.onError(e => {
            logger.error(e);
        });
        listener.start()
    },
};

if (require.main === module) {
    worker.start();
} else {
    module.exports = worker;
}


