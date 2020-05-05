const express = require('express');
const ReplyListener = require("../lib/reply-listener");
const _ = require("lodash");
const jwt = require('jsonwebtoken');
const moment = require("moment");
const router = express.Router();
const path = require("path");

module.exports = async (context) => {
    const config = context.config;
    const logger = context.logger;
    const jwtSecret = config.jwtSecret;
    const fileStorage = config.fileStorage;
    const listener = new ReplyListener(context);
    await listener.start();

    router.get("/_cache", (req, res, next) => {
        res.json(listener.getStatus());
    });

    router.get("/:id*", (req, res, next) => {
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

    router.get("/:id/attachments/:fileName", (req, res, next)=> {
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

    router.get("/:id", (req, res, next) => {
        const ticketId = req.params.id;

        // TODO: handle worker rejection
        listener.onReply(ticketId,
            (reply) => {
                res.send(reply);
            }, () => {
                res.sendStatus(504);
            }
        );
    });

    return router;
};