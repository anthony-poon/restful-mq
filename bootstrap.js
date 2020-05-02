module.exports = async (config) => {
    const app = require("./app");
    const amqp = require('amqplib');
    app.set("config", config);

    // Initialize logger
    const winston = require('winston');
    const logLevel = [
        "error",
        "warning",
        "info",
        "debug",
    ].includes(config["__APP__"]["log_level"].toLowerCase()) ? config["__APP__"]["log_level"].toLowerCase() : "warning";
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
    app.set("logger", logger);
    logger.info("Logger initialized. Log level: " + logLevel.toUpperCase());

    // Start message queue
    logger.info("Initializing message queue.");
    const conn = await amqp.connect('amqp://localhost');
    const channel = await conn.createChannel();
    app.set("amqp_connection", conn);
    app.set("amqp_channel", channel);
    logger.info("Message queue initialized.");

    // Standard express builder initialization


    // setup routing
    const apiRouter = require('./routes/api');
    const heartBeatRouter = require('./routes/heart-beat');
    const ticketsRouter = require('./routes/tickets');

    app.use('/api', apiRouter);
    app.use('/heart-beat', heartBeatRouter);
    app.use('/tickets', ticketsRouter);

    return app;
};