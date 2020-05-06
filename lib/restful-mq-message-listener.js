const RestfulMQMessage = require("./restful-mq-message");
const amqp = require("amqplib");
const moment = require("moment");
const process = require('process');
const os = require('os');
const axios = require("axios");
const FormData = require('form-data');
const fs = require("fs");
const path = require("path");
const _ = require("lodash");

class RestfulMqMessageListener {
    constructor({url, queue}, socketOptions = {}, queueOptions = {}) {
        this._url = url;
        this._queue = queue;
        this._listener = {};
        this._socketOptions = socketOptions;
        this._queueOptions = queueOptions;
        if (!this._url) {
            throw new Error("Missing AMQP url");
        }
        if (!this._queue) {
            throw new Error("Missing AMQP queue name");
        }
    }

    async start() {
        this._conn = await amqp.connect(this._url, this._socketOptions);
        this._channel = await this._conn.createChannel();
        await this._channel.assertQueue(this._queue, this._queueOptions);
        this._channel.consume(this._queue, (amqpMsg) => {
            let isReplySent = false;
            const jsonObj = JSON.parse(amqpMsg.content.toString());
            const errorHandler = (e) => {
                !!this._listener["error"] && this._listener["error"](e);
                if (!isReplySent) {
                    // When error handling, json might not be in valid status
                    // Attempt to decode and see if we can get the ticketId;
                    // No reply if missing critical info
                    if (jsonObj && jsonObj.ticketId && jsonObj.jwtToken && jsonObj.replyTo) {
                        const returnMsg = {
                            ticketId: jsonObj.ticketId,
                            httpStatus: 500,
                            contentType: "text/plain",
                            body: e.message,
                            jwtToken: jsonObj.jwtToken,
                            createdOn: moment().format(),
                            pid: process.pid,
                            host: os.hostname()
                        };
                        this._channel.sendToQueue(jsonObj.replyTo, Buffer.from(JSON.stringify(returnMsg)));
                    }
                }
            };
            try {
                this._channel.ack(amqpMsg);
                const req = new RestfulMQMessage(jsonObj);
                req.downloadAttachments = async () => {
                    if (!req.attachments.length) {
                        return null;
                    }
                    const jobs = _.map(req.attachments, attachment => {
                        return axios({
                            method: "get",
                            url: attachment.url,
                            headers: {
                                "Authorization": "Bearer " + req.jwtToken
                            },
                        });
                    });
                    const responses = await Promise.all(jobs);
                    return _.map(responses, response => {
                        return response.data
                    });
                };
                const res = {
                    httpStatus: 200,
                    status: (httpStatus) => {
                        res.httpStatus = httpStatus;
                        return res;
                    },
                    sendStatus: (httpStatus) => {
                        try {
                            res.httpStatus = httpStatus;
                            const returnMsg = {
                                ticketId: req.ticketId,
                                httpStatus: res.httpStatus,
                                contentType: "application/json",
                                body: null,
                                jwtToken: req.jwtToken,
                                createdOn: moment().format(),
                                pid: process.pid,
                                host: os.hostname()
                            };
                            this._channel.sendToQueue(req.replyTo, Buffer.from(JSON.stringify(returnMsg)));
                        } catch (e) {
                            errorHandler(e);
                        }
                    },
                    send: async (str, options = {}) => {
                        try {
                            if (isReplySent) {
                                throw new Error("Reply already sent. Cannot send multiple reply");
                            }
                            const returnMsg = {
                                ticketId: req.ticketId,
                                httpStatus: res.httpStatus,
                                contentType: !!options.contentType ? options.contentType : "text/plain",
                                body: str,
                                jwtToken: req.jwtToken,
                                createdOn: moment().format(),
                                pid: process.pid,
                                host: os.hostname()
                            };
                            this._channel.sendToQueue(req.replyTo, Buffer.from(JSON.stringify(returnMsg)));
                            isReplySent = true;
                        } catch (e) {
                            errorHandler(e)
                        }
                    },
                    json: async (json) => {
                        try {
                            if (isReplySent) {
                                throw new Error("Reply already sent. Cannot send multiple reply");
                            }
                            json = typeof json === "string" ? json : JSON.stringify(json);
                            const returnMsg = {
                                ticketId: req.ticketId,
                                httpStatus: res.httpStatus,
                                contentType: "application/json",
                                body: json,
                                jwtToken: req.jwtToken,
                                createdOn: moment().format(),
                                pid: process.pid,
                                host: os.hostname()
                            };
                            this._channel.sendToQueue(req.replyTo, Buffer.from(JSON.stringify(returnMsg)));
                            isReplySent = true;
                        } catch (e) {
                            errorHandler(e);
                        }

                    },
                    sendFile: async (file, options = {}) => {
                        try {
                            if (isReplySent) {
                                throw new Error("Reply already sent. Cannot send multiple reply");
                            }
                            const formData = new FormData();
                            formData.append("upload", fs.createReadStream(file));
                            const response = await axios({
                                method: "post",
                                url: req.api + "/attachments",
                                headers: {
                                    ...formData.getHeaders(),
                                    "Authorization": "Bearer " + req.jwtToken,
                                },
                                data: formData
                            });
                            if (!response) {
                                throw new Error("Empty response from server.");
                            }
                            if (response.status !== 200) {
                                throw new Error("HTTP status: " + response.status + ". Status Text: " + response.statusText);
                            }
                            if (!response.data.id) {
                                throw new Error("Invalid response from server. Should contain the id of the uploaded item.");
                            }
                            if (!response.data.jwtToken) {
                                throw new Error("Invalid response from server. Should contain a new JWT token");
                            }
                            const reply = response.data;
                            req.jwtToken = reply.jwtToken;
                            const fileName = options.fileName || path.basename(file);
                            const returnMsg = {
                                ticketId: req.ticketId,
                                httpStatus: res.httpStatus,
                                contentDisposition: "attachment; filename=\"" + fileName + "\"",
                                body: {
                                    id: reply.id
                                },
                                jwtToken: req.jwtToken,
                                createdOn: moment().format(),
                                pid: process.pid,
                                host: os.hostname()
                            };
                            this._channel.sendToQueue(req.replyTo, Buffer.from(JSON.stringify(returnMsg)));
                            isReplySent = true;
                        } catch (e) {
                            errorHandler(e)
                        }
                    }
                };
                !!this._listener["message_received"] && this._listener["message_received"](req, res);
            } catch (e) {
                !!this._listener["error"] && this._listener["error"](e);
            }
        })
    }

    async stop() {
        !!this._channel && this._channel.stop();
        !!this._conn && this._conn.stop();
    }

    onMessageReceived(callback) {
        this._listener["message_received"] = callback;
    }

    onError(callback) {
        this._listener["error"] = callback;
    }
}

module.exports = RestfulMqMessageListener;