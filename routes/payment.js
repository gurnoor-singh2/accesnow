(function () {
    "use strict";

    var config = require(__dirname + '/../common/config');
    var common = require(__dirname + '/../common/common');
    var pg = require('pg');
    var promise = require("q");
	var stripe = require('stripe')(config.stripe.secret_key);
	
    var userHerlper = require(__dirname + '/../routes/user');
    var domainHerlper = require(__dirname + '/../routes/domain');
    var paymentHerlper = {};
    
    paymentHerlper.createDomainProcess = function (req, res) {			
		var opts = {};
		
		opts.domain = req.body.domain;				
		opts.token = req.body.token;				
		opts.stripetoken = req.body.stripetoken;				
		opts.firstname = req.body.firstname;				
		opts.lastname = req.body.lastname;				
		opts.emailaddress = req.body.emailaddress;				
		opts.streetaddr = req.body.streetaddr;				
		opts.zip = req.body.zip;				
		opts.city = req.body.city;				
		opts.country = req.body.country;		
		opts.phone = req.body.phone;		
		opts.password = req.body.password;		
		opts.duration = req.body.duration;		
		opts.amount = req.body.amount;		
		opts.timestamp = common.getTimeStamp();		
				
		var requiredFields = [opts.domain,opts.token,opts.stripetoken,opts.firstname,opts.lastname,opts.emailaddress,opts.streetaddr,opts.zip,opts.city,opts.country,opts.phone,opts.password,opts.duration,opts.amount]
		
		var checkData = common.checkBlank( requiredFields );
		if(checkData == 1){ 										
			res.send(JSON.stringify( { "status": false, "error": 'Some parameter missing', 'status_code':config.statusCodes.fieldRequired } ));
		}
		else if(opts.duration <= 0 || opts.duration > 10){
			res.send(JSON.stringify( { "status": false, "error": 'duration: integer must not be greater than 10', 'status_code':config.statusCodes.invalidRequest } ));
		}
		else{
			
			paymentHerlper._validateStripeToken(opts.stripetoken).then(function(stripetokenResponse){
				
				if(stripetokenResponse.status){
					console.log("Payment token verified");										
					domainHerlper._createGandiContact(opts).then(function(handlerResponse){
						if(handlerResponse.status){
							console.log(handlerResponse);										
							paymentHerlper._processCard(opts.stripetoken,opts.amount,opts.domain).then(function (paymentResponse) {
								if(paymentResponse.status){
									console.log(paymentResponse);
									domainHerlper._domainRegister(handlerResponse.handle,opts.domain,opts.duration).then(function (domainResponse) {
										console.log(domainResponse);
										domainHerlper._domainInsert(handlerResponse,paymentResponse,domainResponse,opts).then(function (dbResponse) {
											res.send(JSON.stringify(dbResponse));					
										});								 
									});						
								}
								else{				
									res.send(JSON.stringify(paymentResponse));					
								}
							});					
						}
						else{
							res.send(JSON.stringify( handlerResponse ));
						}
					});		
				}
				else{
					res.send(JSON.stringify( stripetokenResponse ));
				}
				
			});

		}			
	};	

	//[Exposed Method to Renew the Domain]
	paymentHerlper.renew = function (req, res) {
		var opts = {};
		opts.domain 		= req.body.domain;				
		opts.token 			= req.body.token;				
		opts.stripetoken 	= req.body.stripetoken;	
		opts.duration 		= req.body.duration;	
		opts.amount 		= req.body.amount;
		opts.timestamp 		= common.getTimeStamp();		
		
		if(common.checkBlank( [opts.token,opts.domain,opts.duration,opts.stripetoken,opts.amount] ) == 1){
			res.send(JSON.stringify( { "status": false, "error": 'Some parameter missing','status_code':config.statusCodes.fieldRequired } ));					
		}
		else if(opts.duration <= 0 || opts.duration > 10){
			res.send(JSON.stringify( { "status": false, "error": 'duration: integer must not be greater than 10', 'status_code':config.statusCodes.invalidRequest } ));
		}
		else{
			userHerlper._getToken(opts.token).then(function (tokenResponse) {
				if(tokenResponse.status){
					console.log("User Token Validated");
					domainHerlper._getDomainInfo(tokenResponse.user_id,opts.domain).then(function(domainResponse){						
						if(domainResponse.exist){
							if(domainResponse.data.status == "DONE"){
								console.log("Domain Validated");
								paymentHerlper._validateStripeToken(opts.stripetoken).then(function(stripetokenResponse){
									if(stripetokenResponse.status){
										console.log("Stripe Token Validated");
										var curDate = new Date();								
										var exdate = new Date (domainResponse.data.date_registry_end);
										var renew_spec = {'duration': parseInt(opts.duration),'current_year': exdate.getFullYear()};									 
										paymentHerlper._processCard(opts.stripetoken,opts.amount,opts.domain).then(function (paymentResponse) {
											if(paymentResponse.status){
												console.log(paymentResponse);
												domainHerlper._domainRenew(opts,renew_spec).then(function(domainRenewResponse){
													console.log(domainRenewResponse);

													// Insert into Queue and Transactions table
													domainHerlper._userDomainQueue(domainResponse.data.domain_order_id,'Renew',domainRenewResponse.operation_id,domainRenewResponse.domain_status).then(function(QRes){ 																													
														pg.connect(config.db.connectionString, function (err, client, done) {
															var sql = "INSERT into user_transactions(txn_status, txn_id, txn_amount,domain_order_id,added_on,operation_id) values ($1,$2,$3,$4,$5,$6)";
															client.query(sql,[paymentResponse.payment_status,paymentResponse.txn_id,opts.amount,domainResponse.data.domain_order_id,opts.timestamp,domainRenewResponse.operation_id],function(err,result){
															});
														});
													});

													// send response
													if(domainRenewResponse.domain_status == "ERROR"){
														res.send(JSON.stringify( {"status": false,'error':domainRenewResponse.error,'status_code':config.statusCodes.api.gandi}));
													}	
													else if(domainResponse.domain_status != "DONE"){
														res.send(JSON.stringify( {"status": true,'status_code':config.statusCodes.inprogress} ));
													}
													else if(domainResponse.domain_status == "DONE"){
														domainHerlper._updateDomainInformation(opts.domain,opts.duration).then(function(updRes){ });
														res.send(JSON.stringify( {"status": true,'status_code':config.statusCodes.success} ));	
													}

												});
											}
											else{
												res.send(JSON.stringify(paymentResponse));		
											}		
										});
									}
									else{
										res.send(JSON.stringify( stripetokenResponse ));	
									}
								});		
							}
							else{
								res.send(JSON.stringify( { "status": false, "error": "Domain is not activated yet. Please try after some time.",'status_code':config.statusCodes.invalidRequest } ));
							}				
						}
						else{
							res.send(JSON.stringify( { "status": false, "error": "Invalid Access",'status_code':config.statusCodes.invalidRequest } ));
						}
					});
				}
				else{
					res.send(JSON.stringify( { "status": false, "error": tokenResponse.error,'status_code':config.statusCodes.invalidRequest } ));
				}
			});
		}
	};

	
	//[Exposed method to charge card]		
	paymentHerlper._processCard = function(stripeToken,amount,domain){
		var deferred = promise.defer();
		stripe.charges.create( 
			{
				card: stripeToken, 
				currency: config.stripe.currency, 
				amount:amount,
				description: "Charge for "+domain
			}, 
			function(err, charge) {
				if (err) {
					deferred.resolve( { "status": false, "error": err.message , 'status_code':config.statusCodes.api.stripe} );					
				} 
				else {
					//deferred.resolve( { "status": true, 'txn_id':charge.balance_transaction, 'payment_status':charge.status} );					
					deferred.resolve( { "status": true, 'txn_id':charge.id, 'payment_status':charge.status} );					
				}
			}
		);
		return deferred.promise;
	};	
	
	//[Exposed method to validate the stripe token]		
	paymentHerlper._validateStripeToken = function(stripeToken){
		var deferred = promise.defer();
		stripe.tokens.retrieve(
			stripeToken,
			function(err, token) {
				if (err) {
					deferred.resolve( { "status": false, "error": err.message , 'status_code':config.statusCodes.api.stripe} );					
				}
				else{					
					if(token.used){
						deferred.resolve( { "status": false, "error": 'Payment Token is already used: '+stripeToken , 'status_code':config.statusCodes.api.stripe} );		
						
					}
					else{
						deferred.resolve( { "status": true} );					
					}					
				}
			}
		);
		return deferred.promise;
	};
	
	// [Exposed Method to Refund the payment]
	paymentHerlper.refund = function (req, res) {
		stripe.charges.createRefund(
  			"ch_16Wh7xGIeCYSX4huq5NKf4Ne",{ },
  			function(err, refund) {
    			if(err){
    				res.send(JSON.stringify( { "status": false, "error": err.message , 'status_code':config.statusCodes.api.stripe} ));
    			}
    			else{
    				res.send(JSON.stringify( { "status": true, "refund_id": refund.id,'status_code':config.statusCodes.success} ));
    			}
    			
  			}
		);
	};

	
	// [Below the extra functions for testing]
	paymentHerlper.stripetoken = function (req, res) {			
		stripe.tokens.create({
			card: {
				"number": '4242424242424242',
				"exp_month": 12,
				"exp_year": 2016,
				"cvc": '123'
			}
		}, 
		function(err, token) {
			res.send(JSON.stringify( { "token": token.id } ));
		});		
	};
		
	
    module.exports = paymentHerlper;

})();
