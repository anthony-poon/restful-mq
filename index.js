"use strict";
const _ = require("lodash");
const uniqid = require("uniqid");
const express = require("express");
const winston = require('winston');
const amqp = require('amqplib');
const http = require('http');
const bodyParser = require("body-parser");
class RestMQ {
    constructor(config = {}) {
        this.context = {
            app: null,
            amqpChannel: null,
            amqpConnection: null,
            config: null,
            logger: null,
            applications: []
        };
        this.parseConfig(config);
    }

    parseConfig(config) {
        this.context.config = {};
        this.context.config.logLevel = config["log_level"] || "warning";
        this.context.config.logLevel = [
            "error",
            "warning",
            "info",
            "debug",
        ].includes(this.context.config.logLevel.toLowerCase()) ? this.context.config.logLevel.toLowerCase() : "warning";
        this.context.config.jwtSecret = config["jwt_secret"] || uniqid();
        this.context.config.port = config["port"] || 8080;
        this.context.config.amqpUrl = config["amqp_url"] || "amqp://localhost";

        this.context.config.replyQueue = config["reply_queue"] || uniqid();
        this.context.config.api = config["api"] || [];
    }

    async start() {
        const loggerFormat = winston.format.printf(({ level, message, timestamp }) => {
            return `[${timestamp}][${level.toUpperCase()}]: ${message}`;
        });
        this.context.logger = winston.createLogger({
            level: this.context.config.logLevel,
            format: winston.format.combine(
                winston.format.timestamp(),
                loggerFormat
            ),
            transports: [ new winston.transports.Console() ]
        });
        this.context.logger.info("Logger initialized. Log level: " + this.context.config.logLevel.toUpperCase());

        this.context.app = express();
        this.context.app.use(bodyParser.text());
        this.context.app.use(express.json());
        this.context.app.use(express.urlencoded({ extended: false }));

        this.context.logger.info("Initializing message queue.");
        this.context.amqpConnection = await amqp.connect(this.context.config.amqpUrl);
        this.context.amqpChannel = await this.context.amqpConnection.createChannel();
        this.context.logger.info("Message queue initialized.");
        //
        // this._proxy = httpProxy.createProxyServer();
        // this._proxy.on("error", e => this._logger.error(e));

        const apiRouter = await require('./routes/api')(this.context);
        const heartBeatRouter = await require('./routes/heart-beat')(this.context);
        const ticketsRouter =await  require('./routes/tickets')(this.context);

        this.context.app.use('/api', apiRouter);
        this.context.app.use('/heart-beat', heartBeatRouter);
        this.context.app.use('/tickets', ticketsRouter);

        this._server = http.createServer(this.context.app);
        this._server.listen(this.context.config.port);

        this._server.on('listening', () => {
            const addr = this._server.address();
            const bind = typeof addr === 'string'
                ? 'pipe ' + addr
                : 'port ' + addr.port;
            this.context.logger.info('Listening on ' + bind);
        });

        return true;
    }

    async stop() {
        await this.context.amqpChannel.close();
        await this.context.amqpConnection.close();
        await this._server.close();
        return true;
    }
}

module.exports = RestMQ;