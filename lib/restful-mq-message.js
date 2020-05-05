"use strict";
const moment = require("moment");

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
        this._checkFieldExist(message.request, "url");
        this._url = message.request.url;
        this._checkFieldExist(message.request, "hostname");
        this._hostname = message.request.hostname;
        this._checkFieldExist(message.request, "ip");
        this._ip = message.request.ip;
        this._checkFieldExist(message.request, "headers");
        this._headers = message.request.headers || [];
        this._checkFieldExist(message.request, "content");
        this._content = message.request.content;
        this._checkFieldExist(message, "jwtToken", true);
        this._jwtToken = message.jwtToken
    }

    _checkFieldExist(message, fieldName, isTruthy = false) {
        if (!message.hasOwnProperty(fieldName)) {
            throw new Error("Message missing field " + fieldName + ".");
        }
        if (isTruthy && !message[fieldName]) {
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
        return this._url;
    }

    get hostname() {
        return this._hostname;
    }

    get ip() {
        return this._ip;
    }

    get headers() {
        return this._headers;
    }

    get content() {
        return this._content;
    }

    get jwtToken() {
        return this._jwtToken;
    }
}

module.exports = RestfulMQMessage;