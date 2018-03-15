// below code is the example of middleware creation

// const request = require('request');
//
module.exports = [
//     async function retrieveToken(msg, cfg) {
//         const reqOptions = {
//             headers: {
//                 Authorization: `Basic ${new Buffer(`${cfg.clientId}:${cfg.clientPassword}`).toString('base64')}`,
//                 'content-type': 'application/x-www-form-urlencoded'
//             },
//             uri: 'http://account.demandware.com/dw/oauth2/access_token',
//             body: 'grant_type=client_credentials'
//         }
//
//         const {access_token: token} = await new Promise((resolve, reject) => {
//             request.post(reqOptions, (error, response, body) => {
//                 if (error) {
//                     return reject(error);
//                 }
//
//                 console.log('token response:', body);
//
//                 resolve(JSON.parse(body));
//             });
//         });
//
//         cfg.headers = JSON.parse(cfg.headers || '{}');
//         cfg.headers.Authorization = `Bearer ${token}`;
//
//         cfg.headers = JSON.stringify(cfg.headers);
//
//         return {
//             msg,
//             cfg
//         };
//     }
];
