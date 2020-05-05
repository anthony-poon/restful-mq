const moment = require("moment");

class InternalMessageDTO {
    constructor() {
        this._ticketId = null;
        this._replyTo = null;
        this._expireOn = null;
        this._jwtToken = null;
        this._attachments = [];
        this._request = {};
    }


    get ticketId() {
        return this._ticketId;
    }

    set ticketId(value) {
        this._ticketId = value;
    }

    get expireOn() {
        return this._expireOn.format();
    }

    set expireOn(value) {
        this._expireOn = moment(value);
    }

    get jwtToken() {
        return this._jwtToken;
    }

    set jwtToken(value) {
        this._jwtToken = value;
    }

    get attachments() {
        return this._attachments;
    }

    set attachments(value) {
        this._attachments = value;
    }

    get request() {
        return this._request;
    }

    set request(value) {
        this._request = value;
    }


    get replyTo() {
        return this._replyTo;
    }

    set replyTo(value) {
        this._replyTo = value;
    }

    toJSON() {
        return JSON.stringify({
            ticketId: this.ticketId,
            expireOn: this.expireOn,
            request: this.request,
            jwtToken: this.jwtToken,
            attachments: this.attachments,
            replyTo: this.replyTo
        })
    }
}

module.exports = InternalMessageDTO;