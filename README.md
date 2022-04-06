# This package is no longer maintained. 

### The packaged live on NPM is NOT maintained by me and the code for it could change at any time (if the owner of it decided to change something in the code)

---

# clever-passport

Passport strategy for Instant Login with Clever

This module is a version of [raclim's passport-clever](https://github.com/raclim/passport-clever), with tons of bug fixes.

## Installation

Install the package via npm: `npm install clever-passport`

## Usage

#### Requirements

To use this module, you will need a [Clever Developer Account](https://apps.clever.com/signup) . Then create an application and retrieve/fill out the following: clientID, clientSecret, and redirect URIs (enter your redirect URIs).

#### Configuration

Initialize the strategy as follows:

```js
const CleverStrategy = require('clever-passport').Strategy;
passport.use(new CleverStrategy({
    clientID: "<client id>",
    clientSecret: "<client secret>",
    callbackURL: "<callback url>",
    passReqToCallback: true
}, function(req, accessToken, refreshToken, profile, done) {
    User.findOrCreate({ cleverId: profile.data.id }, function(err, user) {
        return done(err, user);
}}));
```

#### Authenticate Requests

Use `passport.authenticate()` to authunicate the requests.

For example, you could implement it with [Express](http://expressjs.com/) like this:

```js
app.get("/login", passport.authenticate("clever"));

app.get("/callback", passport.authenticate("clever", { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/"); //redirect on successful authentication
});
```

## Disclaimer

This repository is NOT developed or endorsed by Clever. This library is here to help users easily integrate Clever's Instant Login API to their Node.js projects. All questions about the API should be taken to [Clever Support](https://support.clever.com/hc/s/?language=en_US) and all questions about this library should be taken to [milanmdev](mailto:milanmdev@gmail.com).
