/*
 * Twitch oAuth module
 */

//TODO reauth to fix if token is revoked -> ask what I can do there.

const { Task } = require("resource://gre/modules/Task.jsm");

const { prefs } = require("sdk/simple-prefs");
const { defer } = require("sdk/core/promise");
const credentials = require("sdk/passwords");
const self = require("self");

const { OAuth2 } = require("../OAuth2.jsm");


const TOKEN_REALM = "access token";

let twitchOAuth = new OAuth2(
    "http://api.twitch.tv/oauth/authorize",
    "channel_editor+channel_read+chat_login",
    prefs.id
);

twitchOAuth.responseType = "token";
twitchOAuth.completionURI = "https://oauth.humanoids.be/example";

let searchCredentials = (id) => {
    let { promise, resolve, reject } = defer();

    credentials.search({
        url: self.uri,
        realm: TOKEN_REALM,
        username: id,
        onComplete: (creds) => {
            if(creds.length) {
                resolve(creds[0]);
            }
            else {
                reject();
            }
        },
    });

    return promise;
};

let storeTokenInCredentials = (token, id) => {
    credentials.store({
        realm: TOKEN_REALM,
        username: id,
        password: token
    });
};

let auth = () => {
    let p = defer();

    twitchOAuth.connect(() => {
        p.resolve(twitchOAuth.accessToken);
    }, p.reject, true);

    return p.promise;
};

// accountID is unique to this twitch user, so there can be multiple twitch
// accounts (in theory)
exports.getToken = Task.async(function*(accountID) {
    let token;
    try {
        token = yield searchCredentials(accountID);
    } catch() {
        token = yield auth();
        storeTokenInCredentials(token, accountID);
    } finally {
        return token;
    }
});

exports.purgeToken = function(accountID) {
    let { promise, resolve, reject } = defer();
    credentials.remove({
        url: self.uri,
        realm: TOKEN_REALM,
        username: accountID,
        onComplete: resolve,
        onError: reject
    });
};

exports.fixToken = Task.async(function*(accountID) {
    yield exports.purgeToken(accountID);
    return exports.getToken(accountID);
});