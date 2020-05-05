const RestfulMQMessage = require("./restful-mq-message");
const amqp = require("amqplib");
const moment = require("moment");
const process = require('process');
const os = require('os');

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
        this._channel.consume(this._queue, (msg) => {
            try {
                this._channel.ack(msg);
                const parsedMsg = new RestfulMQMessage(JSON.parse(msg.content.toString()));
                const reply = (str, options = {}) => {
                    const returnMsg = {
                        ticketId: parsedMsg.ticketId,
                        reject: false,
                        contentType: !!options.contentType ? options.contentType : "text/plain",
                        body: str,
                        jwtToken: parsedMsg.jwtToken,
                        createdOn: moment().format(),
                        pid: process.pid,
                        host: os.hostname()
                    };
                    this._channel.sendToQueue(parsedMsg.replyTo, Buffer.from(JSON.stringify(returnMsg)));
                };
                const replyJSON = (json) => {
                    json = typeof json === "string" ? json : JSON.stringify(json);
                    const returnMsg = {
                        reject: false,
                        contentType: "application/json",
                        body: json,
                        jwtToken: parsedMsg.jwtToken,
                        createdOn: moment().format(),
                        pid: process.pid,
                        host: os.hostname()
                    };
                    this._channel.sendToQueue(this._queue, Buffer.from(JSON.stringify(returnMsg)));
                };
                const replyFile = () => {

                };
                const replyStream = () => {

                };
                const reject = () => {

                };
                const downloadAttachments = () => {

                };
                !!this._listener["message_received"] && this._listener["message_received"](parsedMsg, {
                    downloadAttachments,
                    reply,
                    replyJSON,
                    replyFile,
                    reject
                });
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