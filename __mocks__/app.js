const winston = require("winston");
const logLevel = process.env.LOG_LEVEL  ? process.env.LOG_LEVEL : "warning";

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

const app = {
    get(key) {
        switch (key) {
            case "logger":
                return logger;
        }
    }
};

module.exports = app;