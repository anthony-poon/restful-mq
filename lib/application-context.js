"use strict";
const winston = require("winston");

const loggerFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}][${level.toUpperCase()}]:\t${message}`;
});
const defaultLogger = winston.createLogger({
    level: "error",
    format: winston.format.combine(
        winston.format.timestamp(),
        loggerFormat
    ),
    transports: [ new winston.transports.Console() ]
});

class ApplicationContext {
    constructor(context = {}) {
        this.app = context.app;
        this.amqpConnection = context.amqpConnection;
        this.amqpChannel = context.amqpChannel;
        this.config = context.config;
        this.logger = context.logger ? context.logger : defaultLogger;
        if (context.applications === undefined) {
            context.applications = [];
        }
        context.applications.push(this);
        this.applications = context.applications;
    }
}

module.exports = ApplicationContext;