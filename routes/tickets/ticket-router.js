"use strict";
const _ = require('lodash');
const ApplicationContext = require("../../lib/application-context");
const ReplyListener = require("./reply-listener");
const express = require("express");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const path = require("path");
const formidable = require("formidable");
const fs = require("fs");
const md5 = require("md5");
const uniqid = require("uniqid");

class TicketRouter extends ApplicationContext {
    constructor(context = {}) {
        super(context);
        const logger = this.logger;
        const jwtSecret = this.config.jwtSecret;
        const fileStorage = this.config.fileStorage;
        const listener = new ReplyListener(context);
        (async () => {
            await listener.start();
        })();

        this.middleware = express.Router();
        this.middleware.get("/_cache", (req, res, next) => {
            res.json(listener.getStatus());
        });

        this.middleware.get("/:id*", (req, res, next) => {
            const authHeader = req.header("Authorization");
            const match = /^Bearer (.+)$/.exec(authHeader);
            if (!match) {
                logger.info("Request dropped due to missing Authorization header");
                res.status(401).send();
                return;
            }
            const token = match[1];
            const decoded = jwt.decode(token);
            try {
                jwt.verify(token, jwtSecret, {
                    ignoreExpiration: true
                })
            } catch (e) {
                logger.info("Request dropped due to invalid jwt token");
                res.status(403).send();
                return;
            }

            if (moment.unix(decoded.exp).isBefore(moment())) {
                logger.info("Request dropped due to jwt already expired");
                res.status(404).send();
                return;
            }

            const ticketId = decoded["ticketId"];
            if (ticketId !== req.params.id) {
                logger.info("Request dropped due to ticket id mismatch");
                res.status(403).send();
                return
            }
            req.decodedJWT = decoded;
            next();
        });

        this.middleware.post("/:id/attachments", async (req, res) => {
            const ticketId = req.params.id;
            logger.debug(req.header("content-type"));
            // TODO: enable config
            const parser = formidable({
                maxFileSize: 200 * 1024 * 1024,
                maxFields: 0,
                maxFieldsSize: 20 * 1024 * 1024,
                multiples: false
            });
            try {
                parser.parse(req, (error, fields, files) => {
                    if (error) {
                        throw error;
                    }
                    if (files.length === 0) {
                        throw new Error("No file received");
                    }
                    const fileName = md5(uniqid());
                    if (!fs.existsSync(fileStorage + "/" + ticketId)) {
                        fs.mkdirSync(fileStorage + "/" + ticketId);
                    }
                    fs.renameSync(files["upload"].path, fileStorage + "/" + ticketId + "/" + fileName);
                    res.json({
                        id: fileName
                    });
                });
            } catch (e) {
                res.status(500).send(e.message);
            }
        });

        this.middleware.get("/:id/attachments/:fileName", (req, res, next)=> {
            const attachments = req.decodedJWT.attachments;
            const ticketId = req.params.id;
            const fileName = req.params.fileName;
            if (!attachments.includes(fileName)) {
                logger.info("No permission to access this resources");
                res.status(403).send();
            }
            const attachmentPath = path.join(fileStorage, ticketId, fileName);
            res.sendFile(attachmentPath);
        });

        this.middleware.get("/:id", (req, res, next) => {
            const ticketId = req.params.id;

            // TODO: handle worker rejection
            listener.onReply(ticketId,
                (reply) => {
                    const contentType = reply.contentType;
                    const httpStatus = reply.httpStatus;
                    res.status(httpStatus).send(reply.body);
                }, () => {
                    res.sendStatus(504);
                }
            );
        });
    }

}

module.exports = TicketRouter;