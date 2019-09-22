const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://3251eeefa7c644de8c5b46af97401d90@sentry.io/1728745' });

module.exports = Sentry;