"use strict";
const _ = require("lodash");
const uniqid = require("uniqid");
const express = require("express");
const winston = require('winston');
const amqp = require('amqplib');
const httpProxy = require('http-proxy');
const http = require('http');
const bodyParser = require("body-parser");
class RestMQ {
    constructor(config = {}) {
        this.parseConfig(config);
    }

    getContext() {
        return {
            app: this._app,
            amqpChannel: this._amqpChannel,
            amqpConn: this._amqpConn,
            config: this._config,
            logger: this._logger,
            proxy: this._proxy
        }
    }

    parseConfig(config) {
        this._config = {};
        this._config.logLevel = config["log_level"] || "warning";
        this._config.logLevel = [
            "error",
            "warning",
            "info",
            "debug",
        ].includes(this._config.logLevel.toLowerCase()) ? this._config.logLevel.toLowerCase() : "warning";
        this._config.jwtSecret = config["jwt_secret"] || uniqid();
        this._config.port = config["port"] || 8080;
        this._config.amqpUrl = config["amqp_url"] || "amqp://localhost";

        this._config.replyQueue = config["reply_queue"] || uniqid();
        this._config.api = config["api"] || [];
    }

    async start() {
        const loggerFormat = winston.format.printf(({ level, message, timestamp }) => {
            return `[${timestamp}][${level.toUpperCase()}]: ${message}`;
        });
        this._logger = winston.createLogger({
            level: this._config.logLevel,
            format: winston.format.combine(
                winston.format.timestamp(),
                loggerFormat
            ),
            transports: [ new winston.transports.Console() ]
        });
        this._logger.info("Logger initialized. Log level: " + this._config.logLevel.toUpperCase());

        this._app = express();
        this._app.use(bodyParser.text());
        this._app.use(express.json());
        this._app.use(express.urlencoded({ extended: false }));

        this._logger.info("Initializing message queue.");
        this._amqpConn = await amqp.connect(this._config.amqpUrl);
        this._amqpChannel = await this._amqpConn.createChannel();
        this._logger.info("Message queue initialized.");

        this._proxy = httpProxy.createProxyServer();
        this._proxy.on("error", e => this._logger.error(e));

        const apiRouter = await require('./routes/api')(this.getContext());
        const heartBeatRouter = await require('./routes/heart-beat')(this.getContext());
        const ticketsRouter =await  require('./routes/tickets')(this.getContext());

        this._app.use('/api', apiRouter);
        this._app.use('/heart-beat', heartBeatRouter);
        this._app.use('/tickets', ticketsRouter);

        this._server = http.createServer(this._app);
        this._server.listen(this._config.port);

        this._server.on('listening', () => {
            const addr = this._server.address();
            const bind = typeof addr === 'string'
                ? 'pipe ' + addr
                : 'port ' + addr.port;
            this._logger.info('Listening on ' + bind);
        });

        return true;
    }

    async stop() {
        await this._amqpChannel.close();
        await this._amqpConn.close();
        await this._server.close();
        return true;
    }
}

module.exports = RestMQ;