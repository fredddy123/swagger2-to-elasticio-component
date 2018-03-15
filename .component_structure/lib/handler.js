`use strict`;
const { messages } = require('elasticio-node');
const request = require('request');
const querystring = require('querystring');

const { applyMiddlewares } = require('./utils.js');
const middlewares = require('./customMiddlewares.js');

// below code is the example of middlewares usage

// (async () => {
//     console.log('middlewares', middlewares);
//     const { msg, cfg } = await applyMiddlewares({
//
//     }, {
//         clientId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
//         clientPassword: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
//         headers: '{ "asd": "qwe", "zxc": 123 }'
//     }, middlewares);
//
//     console.log('msg', msg);
//     console.log('cfg', cfg);
// })().then(process.exit, console.error);

module.exports = (uri, method) => {
    async function exec(_msg, _cfg) {
        console.log('_msg', JSON.stringify(_msg));
        console.log('_cfg', JSON.stringify(_cfg));

        const { msg, cfg } = await applyMiddlewares(_msg, _cfg, middlewares);

        const headers = cfg.headers;
        const credQueryString = cfg.queryString;
        const body = msg.body;

        const requestOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        }

        if (headers) {
            requestOptions.headers = Object.assign(requestOptions.headers, JSON.parse(headers));
        }

        if (body.body && Object.keys(body.body).length) {
            requestOptions.body = JSON.stringify(body.body);
        }

        if (body.header) {
            requestOptions.headers = Object.assign(requestOptions.headers, body.header);
        }

        if (body.additionalCreds && body.additionalCreds.headers) {
            requestOptions.headers = Object.assign(requestOptions.headers, body.additionalCreds.headers);
        }

        let queryString = '';

        if (body.query) {
            queryString = querystring.stringify(body.query);
        }

        requestOptions.uri = (body.additionalCreds && body.additionalCreds.apiURI || cfg.apiURI) + uri;

        if (body.additionalCreds && body.additionalCreds.queryString) {
            queryString = queryString
            ? `${queryString}&${body.additionalCreds.queryString}`
            : body.additionalCreds.queryString;
        }

        if (credQueryString && credQueryString !== '-') {
            const entireQueryString = `${credQueryString}${queryString ? '&' + queryString : ''}`;

            requestOptions.uri = `${requestOptions.uri}?${entireQueryString}`;
        } else if (queryString) {
            requestOptions.uri = `${requestOptions.uri}?${queryString}`;
        }

        if (body.path) {
            Object.keys(body.path).forEach(key => {
                requestOptions.uri = requestOptions.uri.replace(`{${key}}`, body.path[key]);
            });
        }

        console.log('requestOptions', JSON.stringify(requestOptions));

        return new Promise((resolve, reject) => {
            request[method](requestOptions, (error, response, body) => {
                if (error) {
                    console.log('error', error);
                    return reject(error);
                }

                console.log('response body', body);

                try {
                    resolve(messages.newMessageWithBody(JSON.parse(body)));
                } catch(e) {
                    resolve(messages.newMessageWithBody(body));
                }
            });
        });
    }

    return function action(msg, cfg) {
        try {
            return exec.bind(this)(msg, cfg);
        } catch (error) {
            console.log(error);
            this.emit('error', error);
        } finally {
            this.emit('end');
        }
    }
};
