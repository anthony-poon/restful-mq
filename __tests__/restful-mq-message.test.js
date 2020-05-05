const RestfulMQMessageHelper = require("../lib/restful-mq-message");
const _ = require("lodash");

describe("Test RestfulMQMessageHelper class", () => {
    it("should be able to parse a correct message", () => {
        const raw = {
            "ticketId": "7f4ea80b485c5b6e51abe92ef839d168",
            "expireOn": "2020-05-05T19:06:50+08:00",
            "request": {
                "url": "/v1/basic-api",
                "hostname": "localhost",
                "ip": "::1",
                "headers": {
                    "user-agent": "PostmanRuntime/7.24.1",
                    "accept": "*/*",
                    "cache-control": "no-cache",
                    "postman-token": "9bfc3714-7603-4e30-8760-e3a6ab856f0f",
                    "host": "localhost:8080",
                    "accept-encoding": "gzip, deflate, br",
                    "connection": "keep-alive",
                    "content-type": "multipart/form-data; boundary=--------------------------129786234047862791474819",
                    "content-length": "2968"
                },
                "content": {
                    "foo": "bar"
                }
            },
            "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1ODg2ODAyOTAsInRpY2tldElkIjoiN2Y0ZWE4MGI0ODVjNWI2ZTUxYWJlOTJlZjgzOWQxNjgiLCJhdHRhY2htZW50cyI6WyJiNWFlYjA4NjNhMmEyN2Y1ZTNjOGIzMTc3NzYzYzEzMSJdLCJpYXQiOjE1ODg2NzY2OTB9.M8aHeEWKWv8IltjQWpFe3eN9N9fmq842U6RP12Z66-M",
            "attachments": [
                {
                    "size": 2650,
                    "url": "http://localhost:8080/tickets/7f4ea80b485c5b6e51abe92ef839d168/attachments/b5aeb0863a2a27f5e3c8b3177763c131",
                    "name": "b5aeb0863a2a27f5e3c8b3177763c131",
                    "originalName": "test.txt",
                    "contentType": "text/plain"
                }
            ],
            "replyTo": "3ey1igok9tt2w5c",
        };
        const msg = new RestfulMQMessageHelper(raw);
        expect(msg).toBeTruthy();
        expect(msg.ticketId).toEqual(raw["ticketId"]);
        expect(msg.expireOn).toEqual(raw["expireOn"]);
        expect(msg.url).toEqual(raw["request"]["url"]);
        expect(msg.hostname).toEqual(raw["request"]["hostname"]);
        expect(msg.ip).toEqual(raw["request"]["ip"]);
        expect(msg.headers).toMatchObject(raw["request"]["headers"]);
        expect(msg.jwtToken).toEqual(raw["jwtToken"]);
    })

    it("should throw error if some field is missing", () => {
        const raw = {
            "ticketId": "7f4ea80b485c5b6e51abe92ef839d168",
            "expireOn": "2020-05-05T19:06:50+08:00",
            "request": {
                "url": "/v1/basic-api",
                "hostname": "localhost",
                "ip": "::1",
                "headers": {
                    "user-agent": "PostmanRuntime/7.24.1",
                    "accept": "*/*",
                    "cache-control": "no-cache",
                    "postman-token": "9bfc3714-7603-4e30-8760-e3a6ab856f0f",
                    "host": "localhost:8080",
                    "accept-encoding": "gzip, deflate, br",
                    "connection": "keep-alive",
                    "content-type": "multipart/form-data; boundary=--------------------------129786234047862791474819",
                    "content-length": "2968"
                },
                "content": {
                    "foo": "bar"
                }
            },
            "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1ODg2ODAyOTAsInRpY2tldElkIjoiN2Y0ZWE4MGI0ODVjNWI2ZTUxYWJlOTJlZjgzOWQxNjgiLCJhdHRhY2htZW50cyI6WyJiNWFlYjA4NjNhMmEyN2Y1ZTNjOGIzMTc3NzYzYzEzMSJdLCJpYXQiOjE1ODg2NzY2OTB9.M8aHeEWKWv8IltjQWpFe3eN9N9fmq842U6RP12Z66-M",
            "attachments": [
                {
                    "size": 2650,
                    "url": "http://localhost:8080/tickets/7f4ea80b485c5b6e51abe92ef839d168/attachments/b5aeb0863a2a27f5e3c8b3177763c131",
                    "name": "b5aeb0863a2a27f5e3c8b3177763c131",
                    "originalName": "test.txt",
                    "contentType": "text/plain"
                }
            ],
            "replyTo": "3ey1igok9tt2w5c",
        };
        const optional = ["attachments"];
        _.forEach(Object.keys(raw), (key) => {
            const clone = {...raw};
            if (!optional.includes(key)) {
                delete clone[key];
                expect(() => {
                    const msg = new RestfulMQMessageHelper(clone);
                }).toThrow()
            }
        });
    });
});