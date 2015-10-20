var express = require('express');

var app = express();

var bodyParser = require('body-parser');
// parse application/x-www-form-urlencoded 
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json 
app.use(bodyParser.json())

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

var user = require('./routes/user');
var domain = require('./routes/domain');
var payment = require('./routes/payment');
var cron = require('./routes/cron');

// routes
var apiPath = "/api";
app.post(apiPath + '/user/login', user.login);
app.post(apiPath + '/user/create', user.create);
app.post(apiPath + '/user/logout', user.logout);
app.get(apiPath + '/user/getall', user.getAll);
app.post(apiPath + '/user/info', user.userInfo);

app.post(apiPath + '/domain/verification', domain.verification); 
app.post(apiPath + '/domain/info', domain.domainInfo);    
app.post(apiPath + '/domain/nameservers', domain.nameservers);    
app.post(apiPath + '/domain/getos', domain.getos);    

app.get(apiPath + '/cron/queueprocess', cron.queueProcess);    
app.post(apiPath + '/payment/renew', payment.renew); 

app.post(apiPath + '/payment/domainprocess', payment.createDomainProcess); 

app.get(apiPath + '/payment/stripetoken', payment.stripetoken); 
app.post(apiPath + '/payment/refund', payment.refund); 

// Admin Area Routes
var adminDomain = require('./routes/adminarea/domain');  
app.post(apiPath + '/adminarea/configuration/domainprice/add', adminDomain.addDomain);
app.post(apiPath + '/adminarea/configuration/domainprice/list', adminDomain.domainPriceList); 
app.post(apiPath + '/adminarea/configuration/domainprice/edit', adminDomain.domainPriceEdit); 
app.post(apiPath + '/adminarea/configuration/domainprice/delete', adminDomain.domainPriceDelete); 
app.post(apiPath + '/adminarea/configuration/domainprice/nameservers', adminDomain.confDomainNameservers);

app.listen(process.env.PORT || 3000)
if (process.env.PORT === undefined) {
    console.log("Server Started at port : " + 3000);
}
else {
    console.log("Server Started at port : " + process.env.PORT);
}
