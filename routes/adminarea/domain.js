(function () {
    "use strict";

    var config = require(__dirname + '/../../common/config');
    var common = require(__dirname + '/../../common/common');
    var pg = require('pg');
    var promise = require("q");
    var stripe = require('stripe')(config.stripe.secret_key);
    
    var userHerlper = require(__dirname + '/../../routes/user');
    var domainHerlper = require(__dirname + '/../../routes/domain');
    var adminAreaHerlper = {};
    
    //[Exposed Method to Add Domain Price]   
    adminAreaHerlper.addDomain = function (req, res) { 
        var opts = {};
        opts.id = req.body.id;
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
                            if(opts.id > 0){
                                console.log(opts.id);
                                var sql = "UPDATE domain_top_level SET tld = $1,registration_price = $2,renewal_price = $3,transfer_price = $4,minimum_year_of_registration = $5,allow_registration=$6,allow_transfer=$7,domain_active=$8,updated_on=$9 WHERE id = $10";                                    
                                client.query(sql,[
                                                opts.tld,
                                                opts.registration_price,
                                                opts.renewal_price,
                                                opts.transfer_price,
                                                opts.minimum_year_of_registration,
                                                opts.allow_registration,
                                                opts.allow_transfer,
                                                opts.domain_active,
                                                opts.timestamp,
                                                opts.id
                                    ],function (err, result) { 
                                    if(err){
                                        res.send(JSON.stringify( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} ) );
                                    }
                                    else{
                                        res.send(JSON.stringify( {"status": true, 'status_code':config.statusCodes.success} ) );   
                                    }
                                });    
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
    
    //[Exposed Method to get Domain Price List]   
    adminAreaHerlper.domainPriceList = function (req, res) { 
        var opts = {};        
        opts.token = req.body.token;    
        userHerlper._validateSuperUserToken(opts.token).then(function (tokenResponse) { 
            if(tokenResponse.status){
                pg.connect(config.db.connectionString, function (err, client, done) {
                    if(err){
                        res.send(JSON.stringify( { "status": false, "error": 'Unable to connect to DB' } ));    
                    }
                    else{
                        var results = [];

                        var query = client.query("SELECT * FROM domain_top_level order by id");
                        query.on('row', function (row) {
                            results.push(row);
                        });

                        query.on('end', function () {
                            return res.json(results);
                        });
                    }
                });
            }
            else{
                res.send(JSON.stringify( tokenResponse ));
            }
        });
    };
    
    adminAreaHerlper.domainPriceEdit = function (req, res) { 
        var opts = {};        
        opts.id    = req.body.id;    
        opts.token = req.body.token;    
        userHerlper._validateSuperUserToken(opts.token).then(function (tokenResponse) { 
            if(tokenResponse.status){
                if(opts.id > 0){
                    pg.connect(config.db.connectionString, function (err, client, done) {
                        if(err){
                            res.send(JSON.stringify( { "status": false, "error": 'Unable to connect to DB' } ));    
                        }
                        else{
                             var sql = "SELECT * FROM domain_top_level WHERE id = $1";
                             client.query(sql, [opts.id], function (err, response) {
                                done();
                                if (response.rowCount == 0) {                                   
                                    res.send(JSON.stringify( { "status": false, "error":'No Record Found.','status_code':config.statusCodes.invalidRequest} ));                                 
                                }
                                else {                              
                                    var results = [];                                                                   
                                    res.send(JSON.stringify( { 
                                            "status": true, 
                                            'status_code':config.statusCodes.success,
                                            'data':response.rows,
                                            } 
                                    ));     
                                                
                                }
                            });
                        }
                    });
                }
                else{
                    res.send(JSON.stringify( { "status": false, "error": 'Invalid ID', 'status_code':config.statusCodes.fieldRequired } ));
                }
            }
            else{
                res.send(JSON.stringify( tokenResponse ));   
            }
        });
    };


    adminAreaHerlper.domainPriceDelete = function (req, res) { 
        var opts = {};        
        opts.id    = req.body.id;    
        opts.token = req.body.token;    
        userHerlper._validateSuperUserToken(opts.token).then(function (tokenResponse) {
            if(tokenResponse.status){
                if(opts.id > 0){
                    pg.connect(config.db.connectionString, function (err, client, done) {
                        if(err){
                            res.send(JSON.stringify( { "status": false, "error": 'Unable to connect to DB' } ));    
                        }
                        else{
                             var sql = "DELETE FROM domain_top_level WHERE id = $1";
                             client.query(sql, [opts.id], function (err, response) {
                                done();
                                if (response.rowCount == 0) {                                   
                                    res.send(JSON.stringify( { "status": false, "error":'No Record Found.','status_code':config.statusCodes.invalidRequest} ));                                 
                                }
                                else {    
                                    res.send(JSON.stringify( { "status": true,'status_code':config.statusCodes.success} )); 
                                }
                            });
                        }
                    });
                }
                else{
                    res.send(JSON.stringify( { "status": false, "error": 'Invalid ID', 'status_code':config.statusCodes.fieldRequired } ));
                }
            }
            else{
                res.send(JSON.stringify( tokenResponse ));   
            }
        });
    };


    adminAreaHerlper.confDomainNameservers = function (req, res) { 
        var opts = {};                        
        opts.domain_nameserver_1    = req.body.domain_nameserver_1;    
        opts.domain_nameserver_2    = req.body.domain_nameserver_2;    
        opts.domain_nameserver_3    = req.body.domain_nameserver_3;    
        opts.domain_nameserver_4    = req.body.domain_nameserver_4;    
           
        userHerlper._validateSuperUserToken(req.body.token).then(function (tokenResponse) {
            if(tokenResponse.status){                
                for(var i in opts){                     
                  //if(i != "" & typeof opts[i] !== "undefined"){
                        adminAreaHerlper._updateSettings(i,opts[i]).then(function(settingRes){
                        }); 
                  // }                    
                }     
                res.send(JSON.stringify( { "status": true,'status_code':config.statusCodes.success} ));      
            }
            else{
                res.send(JSON.stringify( tokenResponse ));
            }
        }); 
    };


    adminAreaHerlper._updateSettings = function (option_name,option_value) {
        var deferred = promise.defer();
        pg.connect(config.db.connectionString, function (err, client, done) {
            client.query("UPDATE settings SET option_val = $1 WHERE option_name = $2", [option_value,option_name], function (err, response) {
                done();  
                if(err){
                    console.log(err);
                    deferred.resolve({ 'status': false });
                }
                else{
                    deferred.resolve({ 'status': true });
                }           
            });
        });
        return deferred.promise;
    };  


    module.exports = adminAreaHerlper;

})();
