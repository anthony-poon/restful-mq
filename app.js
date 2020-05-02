const express = require("express");
const app = express();
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

module.exports = app;