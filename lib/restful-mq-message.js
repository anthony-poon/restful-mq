"use strict";
const moment = require("moment");
const _ = require("lodash");

class RestfulMQMessage {
    constructor(message) {
        if (!message) {
            throw new Error("Invalid message.")
        }
        this._checkFieldExist(message, "ticketId", true);
        this._checkFieldExist(message, "replyTo", true);
        this._ticketId = message.ticketId;
        this._replyTo = message.replyTo;
        this._checkFieldExist(message, "expireOn", true);
        const expireOn = moment(message.expireOn);
        if (!expireOn) {
            throw new Error("Invalid format - expireOn");
        }
        this._expireOn = expireOn.format();
        this._checkFieldExist(message, "request", true);
        this._request = {};
        this._checkFieldExist(message.request, "url");
        this._request.url = message.request.url;
        this._checkFieldExist(message.request, "hostname");
        this._request.hostname = message.request.hostname;
        this._checkFieldExist(message.request, "ip");
        this._request.ip = message.request.ip;
        this._checkFieldExist(message.request, "headers", true);
        this._request.headers = message.request.headers;
        _.forEach(message.headers, header => {
            this._checkFieldExist(header, "Content-Type");
            this._checkFieldExist(header, "Accept");
        });
        this._checkFieldExist(message.request, "body");
        this._request.body = message.request.body;
        this._checkFieldExist(message, "jwtToken", true);
        this._jwtToken = message.jwtToken;
        this._checkFieldExist(message, "attachments");
        this._attachments = message.attachments || [];
        if (!!this.attachments) {
            _.forEach(message.attachments, attachment => {
                this._checkFieldExist(attachment, "size");
                this._checkFieldExist(attachment, "name");
                this._checkFieldExist(attachment, "url");
                this._checkFieldExist(attachment, "originalName");
                this._checkFieldExist(attachment, "contentType");
            });
        }
        this._checkFieldExist(message, "api");
        this._api = message.api;
    }

    _checkFieldExist(obj, fieldName, isTruthy = false) {
        if (!obj.hasOwnProperty(fieldName)) {
            throw new Error("Message missing field " + fieldName + ".");
        }
        if (isTruthy && !obj[fieldName]) {
            throw new Error("Field " + fieldName + " must not be empty.");
        }
    }


    get ticketId() {
        return this._ticketId;
    }

    get replyTo() {
        return this._replyTo;
    }

    get expireOn() {
        return this._expireOn;
    }

    get url() {
        return this._request.url;
    }

    get hostname() {
        return this._request.hostname;
    }

    get ip() {
        return this._request.ip;
    }

    get headers() {
        return this._request.headers;
    }

    get jwtToken() {
        return this._jwtToken;
    }

    get attachments() {
        return this._attachments;
    }

    set addAttachment(attachment) {
        this._attachments.push(attachment);
    }

    get api() {
        return this._api;
    }

    set api(value) {
        this._api = value;
    }

    get body() {
        return this._request.body;
    }

    toJSON() {
        return JSON.stringify({
            ticketId: this.ticketId,
            expireOn: this.expireOn,
            api: this.api,
            request: {
                ...this._request
            },
            jwtToken: this.jwtToken,
            attachments: this.attachments,
            replyTo: this.replyTo
        })
    }
}

module.exports = RestfulMQMessage;