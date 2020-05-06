const uniqid = require('uniqid');
const moment = require("moment");
const ApplicationContext = require("../../lib/application-context");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const normalizeUrl = require('normalize-url');
const formidable  = require("formidable");
const RestfulMQMessage = require("../../lib/restful-mq-message");
const _ = require("lodash");
const fs = require("fs");
const md5 = require("md5");

class MessageQueueHandler extends ApplicationContext{
    constructor(context = {}) {
        super(context);

        this.middleware = async (req, res, context) => {
            const channel = this.amqpChannel;
            const jwtSecret = this.config.jwtSecret;
            const replyQueue = this.config.replyQueue;
            const logger = this.logger;
            const fileStorage = this.config.fileStorage;
            const isAsync = !!req.query["async"];
            const timestamp = moment();
            try {
                const ticketExp = isAsync ? timestamp.add(1, "days") : timestamp.add(2, "minutes");
                await channel.assertQueue(context["queue_name"], {
                    durable: false
                });

                const ticketId = md5(uniqid());
                // If it is an async query, issue a token valid for 2 min, otherwise 1 day
                const externalToken = jwt.sign({
                    exp: ticketExp.unix(),
                    ticketId
                }, jwtSecret);
                const request =  {
                    "url": req.url,
                    "hostname": req.hostname,
                    "ip": req.ip,
                    "headers": {...req.headers},
                    "body": null
                };
                const payload = {
                    ticketId,
                    expireOn: ticketExp.format(),
                    replyTo: replyQueue,
                    api: normalizeUrl(this.config.internalUrl + "/tickets/" + ticketId),
                    attachments: [],
                    request
                };

                // TODO: Config max file / fields size
                if (req.is("multipart/*")) {
                    const parser = formidable.IncomingForm({
                        maxFileSize: 200 * 1024 * 1024,
                        maxFields: 0,
                        maxFieldsSize: 20 * 1024 * 1024,
                        multiples: true
                    });
                    const {fields, files} = await new Promise((resolve, reject) => {
                        parser.parse(req, (error, _fields, _files) => {
                            if (error) {
                                reject(error);
                            } else {
                                const files = _.map(_files, f => {
                                    const baseUrl = this.config.internalUrl;
                                    const size = f.size;
                                    const fileName = md5(uniqid());
                                    const url = baseUrl + "/tickets/" + ticketId + "/attachments/" + fileName;
                                    const oldPath = f.path;
                                    const originalName = f.name;
                                    const contentType = f.type;
                                    if (!fs.existsSync(fileStorage + "/" + ticketId)) {
                                        fs.mkdirSync(fileStorage + "/" + ticketId);
                                    }
                                    fs.renameSync(oldPath, fileStorage + "/" + ticketId + "/" + fileName);
                                    return {
                                        size,
                                        url,
                                        name: fileName,
                                        originalName,
                                        contentType
                                    }
                                });
                                resolve({
                                    fields: _fields,
                                    files
                                })
                            }
                        })
                    });
                    request.body = { ...fields };
                    // TODO: Config internal exp
                    payload.attachments = files;
                    payload.jwtToken = jwt.sign({
                        exp: moment().add(1, "hours").unix(),
                        ticketId,
                        attachments: _.map(files, f => f.name)
                    }, jwtSecret);
                } else {
                    payload.jwtToken = jwt.sign({
                        exp: moment().add(1, "hours").unix(),
                        ticketId,
                    }, jwtSecret);
                    request.body = req.body;
                }
                const message = new RestfulMQMessage(payload);

                logger.info("Proxying request to " + context["queue_name"]);
                channel.sendToQueue(context["queue_name"], Buffer.from(message.toJSON()));

                if (isAsync) {
                    res.json({
                        "ticket_id": ticketId,
                        "timestamp": timestamp.format(),
                        "expire_on": ticketExp.unix(),
                        "jwt_token": externalToken
                    });
                } else {
                    const baseUrl = this.config.internalUrl;
                    const redirect = normalizeUrl(baseUrl + "/tickets/" + ticketId);
                    logger.info("Awaiting result at " + redirect);
                    try {
                        const response = await axios.get(redirect, {
                            headers: {
                                "Authorization": `Bearer ${externalToken}`
                            }
                        });
                        res
                            .set({
                                ...response.headers
                            })
                            .send(response.data);
                    } catch (e) {
                        logger.error(e);
                        if (e.response) {
                            res
                                .status(e.response.status)
                                .set({
                                    ...e.response.headers
                                })
                                .send(e.response.data);
                        } else if (e.request) {
                            res.sendStatus(504);
                        } else {
                            res.sendStatus(500)
                        }
                    }
                }
            } catch (e) {
                logger.error(e);
                res.sendStatus(500);
            }
        };
        this.middleware.bind(this);
    }
}

module.exports = MessageQueueHandler;