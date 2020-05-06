"use strict";
const winston = require('winston');
const RestfulMQMessageListener = require("../lib/restful-mq-message-listener");
const fs = require("fs");
const path = require("path");
const os = require("os");
const md5 = require("md5");
const uniqid = require("uniqid");
const moment = require("moment");
const _ = require("lodash");

const mock_delay = parseInt(process.env.MOCK_DELAY) || 5000;
const inputQueue = process.env.INPUT_QUEUE;
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


const defaultHandler = async (req, res) => {
    logger.debug(JSON.stringify(req));
    if (req.attachments.length) {
        const attachments = await req.downloadAttachments();
        const tmpFilePath = path.join(os.tmpdir(), md5(uniqid()));
        fs.writeFileSync(tmpFilePath, JSON.stringify({
            _meta: req.attachments,
            attachments,
        }));
        res.sendFile(tmpFilePath)
    } else if (req.headers["Accept"] === "text/pain") {
        res.send("Message received at " + moment().format())
    } else {
        res.json({
            "received": moment().format()
        })
    }
};

const rejectAllHandler = async (req, res) => {
    logger.debug(JSON.stringify(req));
    res.sendStatus(500);
};

const alwaysReturnFileHandler = async (req, res) => {
    res.sendFile(path.join(__dirname, "www"));
}

const delayHandler = async (req, res) => {
    setTimeout(() => {
        res.send("ok")
    }, 50000);
}
const worker = {
    handler: delayHandler,
    async start() {
        const listener = new RestfulMQMessageListener({
            url: 'amqp://localhost',
            queue: inputQueue
        }, null, {
            durable: false
        });
        listener.onMessageReceived(worker.handler);
        listener.onError(e => {
            logger.error(e);
        });
        await listener.start()
    },

    useDefaultHandler() {
        this.handler = defaultHandler;
    },
    useRejectAllHandler() {
        this.handler = rejectAllHandler();
    }
};

if (require.main === module) {
    worker.start();
} else {
    module.exports = worker;
}


