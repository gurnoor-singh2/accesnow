(function () {
	"use strict";

	var config = require(__dirname + '/../common/config');
	var common = require(__dirname + '/../common/common');
	var pg = require('pg');
	var promise = require("q");
	var xmlrpc = require('xmlrpc');
	
	var userHerlper = require(__dirname + '/../routes/user');   
	var domainHerlper = {};
	var userTimeStamp = common.getTimeStamp();
		  
	var gandiApi = xmlrpc.createSecureClient({
							host: config.gandi.host,
							port: config.gandi.port,
							path: '/xmlrpc/'
					});

	domainHerlper.verification = function (req, res) {
		 var deferred = promise.defer();
		 if(config.gandi.key != ""){
			 if(config.gandi.key.length == config.gandi.keyLength){
				var domain = req.body.domain;				
				if (typeof domain === 'undefined'){					
					res.send(JSON.stringify( { "status": false, "error": 'Domain Name is Required','status_code':config.statusCodes.fieldRequired} ));
				}
				else{
					domainHerlper._isDomainAvail(domain).then(function(domainAvail){
						if(domainAvail.status){
							res.send(JSON.stringify( { "status": true, "domain": domainAvail.domain, 'status_code':domainAvail.status_code } ));
						}
						else{
							res.send(JSON.stringify( { "status": false, "error": domainAvail.error, 'status_code':domainAvail.status_code } ));
						}
					})
				}
			 }
			 else{				 
				 res.send(JSON.stringify( { "status": false, "error": 'Invalid Gandi API Key','status_code':config.statusCodes.invalidRequest } ));
			 }
		 }
		 else{			
			res.send(JSON.stringify( { "status": false, "error": 'Enter the Gandi API Key','status_code':config.statusCodes.fieldRequired } ));
		 }
		 
		 return deferred.promise;
	};
		
	//[check the domain exist through Gandi APi]	
	domainHerlper._isDomainAvail = function (domain) {
		var deferred = promise.defer();
		gandiApi.methodCall('domain.available', [config.gandi.key, [domain]], function(error,value){	
			if(error){				
				deferred.resolve( { "status": false, "error": "Invalid Request",'status_code':config.statusCodes.invalidRequest} );
			}
			else{			
				if ( value[domain] == 'pending' ) {
					console.log('Again Domain Available API Called');											
					gandiApi.methodCall('domain.available', [config.gandi.key, [domain]], function(error,value){
						if ( value[domain] == 'available' ) {
							var response = { "status": true, "domain":domain, 'status_code':config.statusCodes.success};
						}
						else if ( value[domain] == 'unavailable' ) {
							var response = { "status": false, "error": value[domain],'status_code':config.statusCodes.unavailable};
						}								
						else{
							var response = { "status": false, "error": value[domain],'status_code':config.statusCodes.failure};
						}
						deferred.resolve(response);
					});
				}
				else{							
					if ( value[domain] == 'available' ) {
						var response = { "status": true, "domain":domain, 'status_code':config.statusCodes.success};
					}
					else if ( value[domain] == 'unavailable' ) {
						var response = { "status": false, "error": value[domain],'status_code':config.statusCodes.unavailable};
					}								
					else{
						var response = { "status": false, "error": value[domain],'status_code':config.statusCodes.failure};
					}
					deferred.resolve(response);
				}
			}
		});
		return deferred.promise;			
	};
	
	//[Exposed Method to create Gandi contact]
	domainHerlper._createGandiContact = function (opts) {
		var deferred = promise.defer();				
		userHerlper._getToken(opts.token).then(function (tokenResponse) {
			if(tokenResponse.status){
				console.log("User Logged Token Exceuted");
				domainHerlper._isDomainAvail(opts.domain).then(function(domainAvail){
					if(domainAvail.status){
						console.log("Domain Available");
						var contactRequestData = {'given': opts.firstname,'family': opts.lastname,'email': opts.emailaddress,'streetaddr': opts.streetaddr,'zip': opts.zip,'city': opts.city,'country': opts.country,'phone':opts.phone,'type': 0,'password':opts.password}
						gandiApi.methodCall('contact.create', [config.gandi.key,contactRequestData], function(error,value){
							if(error){
								deferred.resolve( { "status": false, "error": common.getGandiErrTxt(error.faultString),'status_code':config.statusCodes.api.gandi} );
							}
							else{
								deferred.resolve( {"status": true, "handle": value.handle, "user_id":tokenResponse.user_id} );
							}		
						});
					}
					else{
						deferred.resolve( { "status": false, "error": domainAvail.error, 'status_code':domainAvail.status_code } );
					}
				});
			}
			else{
				deferred.resolve({ "status": false, "error": tokenResponse.error,'status_code':config.statusCodes.invalidRequest });
			}
		});		
		return deferred.promise;		
	};
	
	//[Exposed Method to register the domain on Gandi]
	domainHerlper._domainRegister = function (handler_id,domain,duration) {
		var deferred = promise.defer();
		var domain_spec = {
							owner: handler_id,
							admin: handler_id,
							bill: handler_id,
							tech: handler_id,
							nameservers: config.gandi.nameservers,
							duration: parseInt(duration)
						}											
		gandiApi.methodCall('domain.create', [config.gandi.key, domain, domain_spec],function (error, value) {
			 if(error){
				 deferred.resolve( {status: false, "error": common.getGandiErrTxt(error.faultString),'status_code':config.statusCodes.api.gandi,operation_id:value.id} );
			 }
			 else{
				 domainHerlper.operationInfo(value.id,1,'').then(function (opResponse) {
					if(opResponse.status){
						deferred.resolve( {status: true,'gandi_domain_id':value.id,'domain_status':opResponse.step,operation_id:value.id} );
					}
					else{
						deferred.resolve( {status: false, "error": opResponse.msgError,'status_code':config.statusCodes.api.gandi,operation_id:value.id} ); 													 						 
					}
				 });				 
			}						 
		})
		return deferred.promise;
	};
	
	//[Exposed method to check the status of API. This is recursive called. Hit the API 5 times. If still wait,run then send error message]	
	domainHerlper.operationInfo = function (operation_id,countCall,step) {
		var deferred = promise.defer();
		if(countCall > 5){
			deferred.resolve({ status: true, step: step,operation_id:operation_id});			
		}
		else{
			gandiApi.methodCall( 'operation.info', [config.gandi.key, operation_id],function(error, value) {		
				console.log(countCall+') operation status: '+value.step);
				countCall++;
				if(error){
					deferred.resolve({ status: false, msgError: "Invalid Access",operation_id:operation_id});
				}
				else{
					if(value.step == "DONE"){
						deferred.resolve({ status: true, step: value.step, operation_id:operation_id });
					}
					else if(value.step == "ERROR"){
						deferred.resolve({ status: false, msgError: value.last_error, step: value.step, operation_id:operation_id });
					}
					else{ 
						// If status is BILL,WAIT,RUN  - wait 4 seconds for recursive call
						setTimeout(function () {
							deferred.resolve(domainHerlper.operationInfo(operation_id,countCall,value.step));
						}, 4000);
					}
				}
			});
		}
		return deferred.promise;
	};
		
	// update Domain Information
	domainHerlper._updateDomainInformation = function (domain,duration) {
		var deferred = promise.defer();
		gandiApi.methodCall( 'domain.info', [config.gandi.key, domain],function(error, value) {
			if(!error){
				pg.connect(config.db.connectionString, function (err, client, done) {
					var sql = "UPDATE user_domain_order SET autorenew = $1,nameservers = $2,date_registry_end = $3,date_hold_begin = $4,date_hold_end = $5,date_restore_end=$6,duration=$7 WHERE domain_name = $8";
					client.query(sql,[value.autorenew,value.nameservers,value.date_registry_end,value.date_hold_begin,value.date_hold_end,value.date_restore_end,duration,domain],function(err,result){
						console.log(err);
					});	
				});
			}
		});
		return deferred.promise;			
	};
	
	//[Exposed method to change the nameservers of domain]				
	domainHerlper.nameservers = function (req, res) {
		var token = req.body.token;				
		var domain = req.body.domain;				
		var nameserver_1 = req.body.nameserver_1;				
		var nameserver_2 = req.body.nameserver_2;				
		var nameserver_3 = req.body.nameserver_3;				
		var requiredFields = [token,domain,nameserver_1];
		var checkData = common.checkBlank(requiredFields);		
		if(checkData == 1){ 										
			res.send(JSON.stringify( { "status": false, "error": 'Some parameter missing','status_code':config.statusCodes.fieldRequired } ));
		}
		else{
			userHerlper._getToken(token).then(function (tokenResponse) {
				if(tokenResponse.status){
					console.log("Token OK");
					var arrNS = [];
					if(nameserver_1 != "")	arrNS.push(nameserver_1);					
					if(nameserver_2 != "")	arrNS.push(nameserver_2);					
					if(nameserver_3 != "")  arrNS.push(nameserver_3);						
					
					gandiApi.methodCall( 'domain.nameservers.set', [config.gandi.key, domain, arrNS],function(error, value) {	
						
						if(error){
							res.send(JSON.stringify( {"status": false, "error": common.getGandiErrTxt(error.faultString),'status_code':config.statusCodes.api.gandi} ));
						}
						else{			
							console.log(domain);
										
															
							 domainHerlper.operationInfo(value.id,1,'').then(function (opResponse) {
								 console.log(opResponse);
								 if(opResponse.status){										
									domainHerlper._getDomainID(domain).then(function(dRes){
										console.log(dRes);
										if(dRes.exist){
											domainHerlper._userDomainQueue(dRes.domain_order_id,'Nameserver',opResponse.operation_id,opResponse.step).then(function(QRes){ 
												if(QRes.status){
													if(opResponse.step == "DONE"){
														pg.connect(config.db.connectionString, function (err, client, done) {
															if (err) {
																res.send(JSON.stringify( { "status": false, "error": 'Unable to connect to DB' , 'status_code':config.statusCodes.db.ConnectionError } ));
															}
															else{
																console.log("updating domain table");
																var sql = "UPDATE user_domain_order SET nameservers = $1,updated_on=$2 WHERE domain_name = $3";
																client.query(sql,[arrNS,common.getTimeStamp(),domain],function(err,result){
																	if(err){
																		res.send(JSON.stringify( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} ));
																	}
																	else{
																		res.send(JSON.stringify( {"status": true,'status_code':config.statusCodes.success} ));
																	}
																});	
															}
														});
														
														
													}
													else{												
														res.send(JSON.stringify( {"status": true,'status_code':config.statusCodes.inprogress} ));
													}
												}
												else{
													res.send(JSON.stringify( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} ));
												}
											});
										}
										else{
											res.send(JSON.stringify( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} ));
										}											
									});										
								 }
								 else{									 						
									res.send(JSON.stringify( {"status": false, "error": opResponse.msgError,'status_code':config.statusCodes.api.gandi} ));									 						 
								 }
							 });					 						 						
						}						
					});
				}
				else{
					res.send(JSON.stringify( { "status": false, "error": tokenResponse.error,'status_code':config.statusCodes.invalidRequest } ));
				}
			});
		}
	};
		
	//[Exposed method to insert the recornds in database]	
	domainHerlper._domainInsert = function (handlerResponse,paymentResponse,domainResponse,opts) {
		var deferred = promise.defer();			
		pg.connect(config.db.connectionString, function (err, client, done) {
			console.log(err);
			if (err) {				
				deferred.resolve( {"status": false, "error": 'Unable to connect to DB', 'status_code':config.statusCodes.db.ConnectionError} );
			}
			else{
				var sql = "INSERT into user_address(user_id, handler_id, first_name,last_name,email_address,streetaddr,zip,city,country,phone,password,updated_on,added_on) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)";
				client.query(sql,[handlerResponse.user_id,handlerResponse.handle,opts.firstname,opts.lastname,opts.emailaddress,opts.streetaddr,opts.zip,opts.city,opts.country,opts.phone,opts.password,userTimeStamp,userTimeStamp],function (err, result) { 
					if(!err){
						console.log("user_address entry done");
						domainHerlper._getAddress(handlerResponse.handle).then(function(addrResponse){
							if(addrResponse.address_id > 0 && addrResponse.user_id > 0){
								var sql = "INSERT into user_domain_order(address_id, user_id, domain_name,status,updated_on,added_on,duration,txn_id) values ($1,$2,$3,$4,$5,$6,$7,$8)";
								client.query(sql,[addrResponse.address_id,addrResponse.user_id,opts.domain,domainResponse.domain_status,userTimeStamp,userTimeStamp,opts.duration,paymentResponse.txn_id],function(err,result){ 									
									if (!err) {	
										console.log("user_domain_order entry done");									
										domainHerlper._getDomainID(opts.domain).then(function(dRes){ 
											var sql = "INSERT into user_transactions(txn_status, txn_id, txn_amount,domain_order_id,added_on,operation_id) values ($1,$2,$3,$4,$5,$6)";
											client.query(sql,[paymentResponse.payment_status,paymentResponse.txn_id,opts.amount,dRes.domain_order_id,userTimeStamp,domainResponse.operation_id],function(err,result){
												if(!err){
													console.log("user_transactions entry done");
																										
													//if(domainResponse.domain_status != "DONE"){
														domainHerlper._userDomainQueue(dRes.domain_order_id,'Register',domainResponse.operation_id,domainResponse.domain_status).then(function(QRes){ 
															console.log(QRes);
														});
													//}
													
												}
												
											});
										});
										domainHerlper._updateDomainInformation(opts.domain,opts.duration).then(function(updRes){ });
										
										var cStatus = config.statusCodes.success;
										if(domainResponse.domain_status != "DONE"){
											cStatus = config.statusCodes.inprogress;
										}
										deferred.resolve( {"status": true,'status_code':cStatus} );
									}
									else{
										console.log("Error: user_domain_order"+err);
										deferred.resolve( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} );
									}
								});
							}
						});
					}
					else{
						console.log("Error: user_address"+err);
						deferred.resolve( {"status": false, 'error':'Unable to process the request','status_code':config.statusCodes.db.QueryError} );
					}
				});
			}
		});
		return deferred.promise;
	};
		
	//[get the address from handler ID]		
	domainHerlper._getAddress = function (handler_id) {
		var deferred = promise.defer();
		pg.connect(config.db.connectionString, function (err, client, done) {
			client.query("SELECT * FROM user_address WHERE handler_id = $1", [handler_id], function (err, response) {
				done();                
				if (response.rowCount == 0) {
					deferred.resolve({ exist: 0 });
				}
				else{
					deferred.resolve( {exist: 1, 'address_id':response.rows[0].id, 'user_id':response.rows[0].user_id} );
				}
			});
		});
		return deferred.promise;
	};
	
	//[Method used for get the Domain ID from Domain Name]
	domainHerlper._getDomainID = function (domain_name) {
		var deferred = promise.defer();
		pg.connect(config.db.connectionString, function (err, client, done) {
			client.query("SELECT * FROM user_domain_order WHERE domain_name = $1", [domain_name], function (err, response) {
				done();                
				if (response.rowCount == 0) {
					deferred.resolve({ exist: 0 });
				}
				else{
					deferred.resolve( {exist: 1, 'domain_order_id':response.rows[0].id, 'user_id':response.rows[0].user_id} );
				}
			});
		});
		return deferred.promise;
	};
		
	//[Method used to insert the entry in domain queue table]	
	domainHerlper._userDomainQueue = function (domain_order_id,action,operation_id,domain_status) {
		var deferred = promise.defer();
		pg.connect(config.db.connectionString, function (err, client, done) {
			var sql = "INSERT into user_domain_queue(domain_order_id, action, operation_id,status,updated_on,added_on) values ($1,$2,$3,$4,$5,$6)";
			client.query(sql,[domain_order_id,action,operation_id,domain_status,userTimeStamp,userTimeStamp],function(err,result){
				done();                
				if (!err) {
					console.log("user_domain_queue entry done");
					deferred.resolve({ status: true });
				}
				else{
					console.log("Error: user_domain_queue "+err);
					deferred.resolve( {status: false} );
				}
			});
		});
		return deferred.promise;
	};
	
		
	//[get the Domain Information]				
	domainHerlper.domainInfo = function (req, res) {
		var token = req.body.token;				
		var domain = req.body.domain;				
		var requiredFields = [token,domain];
		var checkData = common.checkBlank(requiredFields);		
		if(checkData == 1){ 										
			res.send(JSON.stringify( { "status": false, "error": 'Some parameter missing','status_code':config.statusCodes.fieldRequired } ));
		}
		else{
			userHerlper._getToken(token).then(function (tokenResponse) {
				if(tokenResponse.status){					
					domainHerlper._getDomainInfo(tokenResponse.user_id,domain).then(function(domainRow){
						if(domainRow.exist){
							var response = {
											 "status": true,
											 "data": domainRow.data											
											};
							res.send(JSON.stringify( response ));
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
	
	//[Exposed method to domain exist in database for particular user]
	domainHerlper._getDomainInfo = function (user_id,domain) {
		var deferred = promise.defer();
		pg.connect(config.db.connectionString, function (err, client, done) {
			client.query("SELECT d.*,a.*,d.id as domain_order_id FROM user_domain_order d INNER JOIN user_address a ON d.address_id = a.id WHERE d.user_id = $1 AND d.domain_name = $2", [user_id,domain], function (err, response) {
				done();				
				if (response.rowCount > 0) {
					 deferred.resolve({ exist: 1, data: response.rows[0]  });
				}
				else{
					 deferred.resolve({ exist: 0 });
				}
			});
		});
		return deferred.promise;
	};	
	
	
	//[Exposed method to renew domain]
	domainHerlper._domainRenew = function (opts,renew_spec) {
		var deferred = promise.defer();
		gandiApi.methodCall( 'domain.renew', [config.gandi.key, opts.domain, renew_spec],function(error, value) {								
			if(error){
				deferred.resolve( {"status": false, "error":common.getGandiErrTxt(error.faultString),'status_code':config.statusCodes.api.gandi} );
			}
			else{
				domainHerlper.operationInfo(value.id,1,'').then(function (opResponse) {					
					if(opResponse.status){
						deferred.resolve( {status: true,'domain_status':opResponse.step,operation_id:value.id} );
					}
					else{
						deferred.resolve( {status: false, 'domain_status':opResponse.step, "error": opResponse.msgError,'status_code':config.statusCodes.api.gandi,operation_id:value.id} ); 													 						 
					}
				});	
			}
		});
		return deferred.promise;
	};
	
	
	// [Below the extra functions for testing]
	domainHerlper.handleinfo = function (req, res) {
		var association_spec = {
	   domain: 'accessnowtwoa.com',
	   owner: true,
	   admin: true}
		gandiApi.methodCall('contact.info', [config.gandi.key,'AS78-GANDI'], function(error,value){	
			console.log(error);
			console.log(value);
		});
	};

	domainHerlper.getos = function (req, res) {		
		var operation_id = 224669;
		console.log(operation_id);
		gandiApi.methodCall( 'operation.info', [config.gandi.key, operation_id],function(error, value) {	
			console.log(error);
			console.log(value);
			res.send(JSON.stringify( { "status": true } ));
		});
	};
	
	
	module.exports = domainHerlper;

})();
