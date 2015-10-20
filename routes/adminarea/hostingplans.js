(function () {
    "use strict";

    var config = require(__dirname + '/../common/config');
    var common = require(__dirname + '/../common/common');
    var pg = require('pg');
    var promise = require("q");
	var stripe = require('stripe')(config.stripe.secret_key);
	
    var userHerlper = require(__dirname + '/../routes/user');
    var domainHerlper = require(__dirname + '/../routes/domain');
    var adminAreaHerlper = {};
    
    adminAreaHerlper.addDomain = function (req, res) { 
        var opts = {};        

        opts.token = req.body.token;    
        opts.tld = req.body.tld;   
        opts.registration_price = req.body.registration_price;              
        opts.renewal_price = req.body.renewal_price;
        opts.transfer_price = req.body.transfer_price;
        opts.minimum_year_of_registration = req.body.minimum_year_of_registration;
        opts.allow_registration = req.body.allow_registration;
        opts.allow_transfer = req.body.allow_transfer;
        opts.domain_active = req.body.domain_active;
        opts.timestamp = common.getTimeStamp();

        userHerlper._validateSuperUserToken(opts.token).then(function (tokenResponse) {
            if(tokenResponse.status){
                var requiredFields = [opts.token,opts.tld,opts.registration_price,opts.renewal_price,opts.transfer_price,opts.minimum_year_of_registration,opts.allow_registration,opts.allow_transfer,opts.domain_active];
                var checkData = common.checkBlank( requiredFields );
                if(checkData == 1){                                         
                   res.send(JSON.stringify( { "status": false, "error": 'Some parameter missing', 'status_code':config.statusCodes.fieldRequired } ));
                }
                else if(opts.minimum_year_of_registration <= 0 || opts.minimum_year_of_registration > 10){
                    res.send(JSON.stringify( { "status": false, "error": 'minimum_year_of_registration: integer must not be greater than 10', 'status_code':config.statusCodes.invalidRequest } ));
                }
                else if(opts.registration_price >= 0 & opts.renewal_price >= 0 & opts.transfer_price >= 0){
                    pg.connect(config.db.connectionString, function (err, client, done) {
                        if (err) {
                            res.send(JSON.stringify( { "status": false, "error": 'Unable to connect to DB', 'status_code':config.statusCodes.db.ConnectionError } ));
                        }
                        else{ 
                            var sql = "INSERT into domain_top_level(tld,registration_price, renewal_price,transfer_price,minimum_year_of_registration,allow_registration,allow_transfer,domain_active,updated_on,added_on) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
                            client.query(sql,[opts.tld,opts.registration_price,opts.renewal_price,opts.transfer_price,opts.minimum_year_of_registration,opts.allow_registration,opts.allow_transfer,opts.domain_active,opts.timestamp,opts.timestamp],function (err, result) { 
                                if(err){
                                    res.send(JSON.stringify( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} ) );
                                }
                                else{
                                    res.send(JSON.stringify( {"status": true, 'status_code':config.statusCodes.success} ) );   
                                }
                            });
                        }
                    });
                }
                else{
                    res.send(JSON.stringify( { "status": false, "error": 'Price should be greater than zero', 'status_code':config.statusCodes.invalidRequest } ));
                }
            }
            else{
                res.send(JSON.stringify( tokenResponse ));
            }
        });
    };
    



   

    
    
    module.exports = adminAreaHerlper;

})();
