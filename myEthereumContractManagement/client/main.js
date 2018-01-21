import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';
import './lib/sha256.js';
import './lib/web3.js';
import './lib/web3.min.js';

"use strict"

var CryptoJS = require("crypto-js");
var swarm = require("swarm-js").at("http://swarm-gateways.net");

let debug = true;
let waitCounter = 0;
const maxWaitCounter = 10;
//Template.dapp.helpers({ //Template.dapp.helpersstart
//counter() {return Template.instance().counter.get();},//Template.dapp.helpers start
let eventHandlerPageLoad = function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    // Use your fallback strategy (local node / hosted node)
    // window.web3 = new Web3(new Web3.providers.HttpProvider("https://proxy.mobilefish.com:9070"));
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  // Immediately execute methods after web page is loaded
  startApp();
}

function startApp(){
  if(waitCounter > maxWaitCounter) {
    window.web3 = null;
    if (confirm("The Signature Storage Dapp did not find a web3 provider.\nPlease start your web3 provider (e.g. MetaMask) and reload this page.\nDo you want to continue?")) {
        // Avoid the web page becoming unresponsive
        location.reload();
    } else {
        alert("The Dapp stops executing...");
    }
  } else {
    monitorAccountChanges();
    watchSyncing();
    reloadPageWhenNoNetwork();
    displayActionContent();
    setupDragAndDropFileHandling();
  }
  waitCounter++;
}


window.addEventListener('load', eventHandlerPageLoad);

// Check if an Ethereum node is available every 5 seconds.
// I have chosen arbritray 5 seconds.
function reloadPageWhenNoNetwork(){
    setInterval(function(){
      if(web3 != null && !web3.isConnected()){
        // If an Ethereum node is found, reload web page.
        eventHandlerPageLoad();
      }
    }, 5000);
}

// Source: https://code.google.com/archive/p/crypto-js/issues/62
function calculateSHA256Hash(file){
    const reader = new FileReader();

    reader.onloadend = function(event){
        if (event.target.readyState == FileReader.DONE) {
          const data = event.target.result;
          const sha256 = CryptoJS.algo.SHA256.create();
          sha256.update(CryptoJS.enc.Latin1.parse(data));
          const hash = sha256.finalize();
          const hashValue = [hash].join('');
          document.getElementById('hashFile').value = hashValue;
        }
    }

    reader.readAsBinaryString(file);
}

function handleFileSelect(event) {
  document.getElementById('hashFile').value = "";
  document.getElementById('fileDrop').innerText = "";

  const file = event.target.files[0];
  calculateSHA256Hash(file);
}

// Source: https://www.html5rocks.com/en/tutorials/file/dndfiles/
function setupDragAndDropFileHandling(){
  // Check for the various File API support.
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Setup the drag-and-drop listeners.
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', handleFileDragOver, false);
    dropZone.addEventListener('drop', handleFileDrop, false);
    dropZone.addEventListener('dragenter', handleFileDragEnter, false);
    dropZone.addEventListener('dragleave', handleFileDragLeave, false);
  } else {
    const err = "File APIs are not supported in this browser.";
    const message = debug ? ("setupDragAndDropFileHandling: "+err) : err;
    showResultMessage(message);
  }
}

function handleFileDrop(event) {
  document.getElementById('hashFile').value = "";
  document.getElementById('fileUpload').value = "";
  event.target.style.backgroundColor = "#fffada";

  event.stopPropagation();
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  document.getElementById('fileDrop').innerText = file.name;
  calculateSHA256Hash(file);
}

function handleFileDragEnter(event) {
   event.target.style.backgroundColor = "#278f27";
}

function handleFileDragLeave(event) {
   event.target.style.backgroundColor = "#fffada";
}

function handleFileDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

function monitorAccountChanges() {
  // Declare accountInterval here! Clear the variable if there is no Ethereum node found.
  let accountInterval;

  // Check if an Ethereum node is found.
  if(web3 != null && web3.isConnected()){

    // If a coinbase account is found, automatically update the fromAddress form field with the coinbase account
    getCoinbasePromise()
    .then(function(fromAddress){
      document.getElementById('fromAddress').value = fromAddress;
    })
    .catch(function(err){
      showIntervalMessage(err);
    });

    let account = web3.eth.accounts[0];

    // At a time interval of 1 sec monitor account changes
    accountInterval = setInterval(function() {

      // Monitor account changes. If you switch account, for example in MetaMask, it will detect this.
      // See: https://github.com/MetaMask/faq/blob/master/DEVELOPERS.md
      if (web3.eth.accounts[0] !== account) {
        account = web3.eth.accounts[0];
        document.getElementById('fromAddress').value = account;
      } else {
        showIntervalMessage("No accounts found");
      }
      if(account != null) {
        showIntervalMessage("");
      }

      // Check which Ethereum network is used
      getNetworkPromise()
      .then(function(network){
        document.getElementById('network').innerText = "Network: " + network + "\n\n";
      })
      .catch(function(err){
        if(debug) console.log(err);
      });

    }, 1000); // end of accountInterval = setInterval(function()

  } else {
    // Stop the accountInterval
    clearInterval(accountInterval);
    showIntervalMessage("No Ethereum node found");
  }
}


function createContract(){
  // Each time you modify the SignatureStorage.sol and deploy it on the blockchain, you need to get the abi value.
  // Paste the abi value in web3.eth.contract(PASTE_ABI_VALUE);
  // When the contract is deployed, do not forget to change the contract address, see
  // formfield id 'contractAddress'

  // Contract deployed on Ropsten test network
  const contractAddress = "0xf142786d8569155f4d84680d81422e8311e7eb2f";

//const contractSpec = web3.eth.contract(
//[{"constant": true,"inputs": [],"name": "getAllContractNumbers","outputs": [{"name": "","type": "uint256[]"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "getAllSigneeAddresses","outputs": [{"name": "","type": "address[]"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [],"name": "swarmAddress","outputs": [{"name": "","type": "string"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "getContractState","outputs": [{"name": "","type": "uint8"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [],"name": "owner","outputs": [{"name": "","type": "address"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"},{"name": "_signeeAddress","type": "address"}],"name": "getSigneeStatus","outputs": [{"name": "","type": "uint8"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "getDocumentHash","outputs": [{"name": "","type": "bytes32"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"},{"name": "_hashFile","type": "bytes32"}],"name": "addContract","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"},{"name": "_accountAddresses","type": "address[]"}],"name": "addSignees","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_swarmAddress","type": "string"}],"name": "changeLocation","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "deleteContract","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_newAddress","type": "address"}],"name": "transferOwnership","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "signContract","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"inputs": [],"payable": false,"stateMutability": "nonpayable","type": "constructor"}]
//);

const contractSpec = web3.eth.contract(
[{"constant": true,"inputs": [],"name": "getAllContractNumbers","outputs": [{"name": "","type": "uint256[]"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "getAllSigneeAddresses","outputs": [{"name": "","type": "address[]"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [],"name": "swarmAddress","outputs": [{"name": "","type": "string"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "getContractState","outputs": [{"name": "","type": "uint8"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [],"name": "owner","outputs": [{"name": "","type": "address"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"},{"name": "_signeeAddress","type": "address"}],"name": "getSigneeStatus","outputs": [{"name": "","type": "uint8"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "getDocumentHash","outputs": [{"name": "","type": "bytes32"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"},{"name": "_hashFile","type": "bytes32"}],"name": "addContract","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"},{"name": "_accountAddresses","type": "address[]"}],"name": "addSignees","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_swarmAddress","type": "string"}],"name": "changeLocation","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "deleteContract","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_newAddress","type": "address"}],"name": "transferOwnership","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"constant": false,"inputs": [{"name": "_contractNumber","type": "uint256"}],"name": "signContract","outputs": [],"payable": false,"stateMutability": "nonpayable","type": "function"},{"inputs": [],"payable": false,"stateMutability": "nonpayable","type": "constructor"}]
);

  return contractSpec.at(contractAddress);
}


// ===================================================
// Promises
// ===================================================
const getCoinbasePromise = function(){
  return new Promise(function(resolve, reject){
    web3.eth.getCoinbase(function(err, res){
      if (!res) {
        reject("No accounts found");
      } else {
        resolve(res);
      }
    });
  });
}

const checkAddressPromise = function(address, addressType) {
  return new Promise(function(resolve, reject){
    if (address != null && web3.isAddress(address)) {
      resolve();
    } else {
      reject(addressType);
    }
  });
}

const getAllContractNumbersPromise = function() {
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.getAllContractNumbers(function (err, res) {
      if(err) {
        reject("getAllContractNumbersPromise: "+err);
      } else {
        resolve(res);
      }
    });
  });
}

const getAllSigneeAddressesPromise = function(contractNumber) {
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.getAllSigneeAddresses(contractNumber, function (err, res) {
      if(err) {
        reject("getAllSigneeAddressesPromise: "+err);
      } else {
        resolve(res);
      }
    });
  });
}

const getSigneeStatusPromise = function(contractNumber, address) {
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.getSigneeStatus(contractNumber, address, function (err, res) {
      if(err) {
        reject("getSigneeStatusPromise: "+err);
      } else {
        resolve(res);
      }
    });
  });
}

const getOwnerAddressPromise = function() {
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.owner(function (err, res) {
      if(err) {
        reject("getOwnerAddressPromise: "+err);
      } else {
        resolve(res);
      }
    });
  });
}

const getContractStatePromise = function(contractNumber) {
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.getContractState(contractNumber, function (err, res) {
      if(err) {
        reject("getContractStatePromise: "+err);
      } else {
        resolve(res);
      }
    });
  });
}

const getDocumentHashPromise = function(contractNumber) {
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.getDocumentHash(contractNumber, function (err, res) {
      if(err) {
        reject("getDocumentHashPromise: "+err);
      } else {
        resolve(res);
      }
    });
  });
}

const addContractPromise = function(fromAddress, contractNumber, hashFile){
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.addContract(contractNumber, hashFile, {from: fromAddress}, function (err, txHash) {
      if(txHash) {
        resolve(txHash);
      } else {
        reject("addContractPromise: " +err);
      }
    });
  });
}

const uploadDataToSwarmPromise = function(fromAddress, swarmAddress){
  console.log("inside uploadDataToSwarmPromise. swarmAddress = " + swarmAddress);
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.changeLocation(swarmAddress, {from: fromAddress}, function (err, txHash) {
      if(txHash) {
        resolve(txHash);
      } else {
        reject("uploadDataToSwarmPromise: " +err);
      }
    });
  });
}

const getDataLocationInSwarmPromise = function(){
  console.log("inside getDataLocationInSwarmPromise");
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.swarmAddress(function (err, swarmHash){
      if(swarmHash) {
        resolve(swarmHash);
      }else {
         reject("getDataLocationInSwarmPromise: " +err);
      }
    });
  });
}
function getSwarmLocation(){
  const contract = createContract();
  contract.swarmAddress(function (err, swarmHash){
    if(swarmHash) {
      console.log("swarmHash = " + swarmHash);
      console.log("document.getElementById('pDataLocation').innterText = " + document.getElementById('pDataLocation').innterText)
      document.getElementById("txtSwarmHash").value = swarmHash;
    }else {
      console.log("getSwarmLocationErr:" + err);
    }
  });
}

const addSigneesPromise = function(fromAddress, contractNumber, accountAddresses){
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.addSignees(contractNumber, accountAddresses, {from: fromAddress}, function (err, txHash) {
      if(txHash) {
        resolve(txHash);
      } else {
        reject("addSigneesPromise: " +err);
      }
    });
  });
}

const deleteContractPromise = function(fromAddress, contractNumber){
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.deleteContract(contractNumber, {from: fromAddress}, function (err, txHash) {
      if(txHash) {
        resolve(txHash);
      } else {
        reject("deleteContractPromise: " +err);
      }
    });
  });
}

const signContractPromise = function(fromAddress, contractNumber){
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.signContract(contractNumber, {from: fromAddress}, function (err, txHash) {
      if(txHash) {
        resolve(txHash);
      } else {
        reject("signContractPromise: " +err);
      }
    });
  });
}

const transferOwnershipPromise = function(fromAddress, newAddress){
  return new Promise(function(resolve, reject){
    const contract = createContract();
    contract.transferOwnership(newAddress, {from: fromAddress}, function (err, txHash) {
      if(txHash) {
        resolve(txHash);
      } else {
        reject("transferOwnershipPromise: " +err);
      }
    });
  });
}

const getNetworkPromise = function() {
  return new Promise(function(resolve, reject){
    web3.version.getNetwork(function(err, res){
      let selectedNetwork = "";

      if (!err) {
        if(res > 1000000000000) {
          // I am not sure about this. I maybe wrong!
          selectedNetwork = "Testrpc";
        } else {
          switch (res) {
            case "1":
              selectedNetwork = "Mainnet";
              break
            case "2":
              selectedNetwork = "Morden";
              break
            case "3":
              selectedNetwork = "Ropsten";
              break
            case "4":
              selectedNetwork = "Rinkeby";
              break
            default:
              selectedNetwork = "Unknown network = "+res;
          }
        }
        resolve(selectedNetwork);
      } else {
        reject("getNetworkPromise: "+err);
      }
    });
  });
}

const getTransactionReceiptPromise = function(txhash) {
  return new Promise(function callback(resolve, reject){
      document.getElementById('wait').innerText = 'Waiting for the transaction '+txhash+' to be mined ...';
      web3.eth.getTransactionReceipt(txhash, function (err, result) {
        if (!err && !result) {
            // If there is no error and result, try again with a 0.5 sec delay
            setTimeout(function() { callback(resolve, reject) }, 500);
        } else {
          if (err){
            reject(err);
          } else {
            document.getElementById('wait').innerText = '';
            resolve(result);
          }
        }
      });
  });
}

// ===================================================
// Callback
// ===================================================

// Everytime a sync starts, updates and stops.
function watchSyncing(){
  if(web3 != null && web3.isConnected()) {
	  web3.eth.isSyncing(function(err, sync){
	    if(!err) {
	      // stop all app activity
	      if(sync === true) {
	       // we use `true`, so it stops all filters, but not the web3.eth.syncing polling
	       web3.reset(true);
	      } else if(sync) {
	        // Show sync info. When your Ethereum node is not runnning for a day, your node need to be synchronized.
	        // A message will be displayed on top of screen.
	        //
	       let message = "Syncing from "+sync.currentBlock+" to "+sync.highestBlock;
	       showIntervalMessage(message);
	       // if(debug) console.log("The block number where the sync started = "+sync.startingBlock);
	       // if(debug) console.log("The block number where at which block the node currently synced to already = "+sync.currentBlock);
	       // if(debug) console.log("The estimated block number to sync to = "+sync.highestBlock);
	      } else {
	        // re-gain app operation
	        // if(debug) console.log("startApp");
	        startApp();
	      }
	    }
	  });
  }
}


// ===================================================
// Helper functions
// ===================================================
function clearOutputs(){
  document.getElementById('wait').innerText= "";
  document.getElementById('log').innerText= "";

  showResultMessage("");
  showContractInformationMessage("");
}

// Purpose: Returns true if it is a hexadecimal string: containg only 0123456789ABCDEF.
function isHexadecimal(s){
	if(s== null) {
		return false;
	} else {
		s = s.trim();
	    if (s == ""){
	         return false;
	    } else {
			var re = /^[0-9a-fA-F]+$/;
			if (re.test(s)) {
				return true;
			} else {
				return false;
			}
		}
	}
}

function isContractNumberValid(contractNumber) {
   const validChars = "0123456789";
   let valid=true;
   let charVal;

   if(contractNumber.length == 0) {
     return false;
   }

   for (let i = 0; i < contractNumber.length && valid == true; i++) {
      charVal = contractNumber.charAt(i);
      if (validChars.indexOf(charVal) == -1) {
         valid = false;
      }
   }
   return valid;
}

function isHashValid(hash){
  // This is a simple check.
  // Sha256 contains 64 characters
  // Sha256 only contains hexadecimal characters
  const length = (""+hash).length;

  if(length == 64 && isHexadecimal(hash)){
    return true;
  }

  return false;
}

function showResultMessage(message){
  document.getElementById('result').innerText = message;
}

function showIntervalMessage(message){
  document.getElementById('intervalErrorMessage').innerText = message;
}

function showContractInformationMessage(message){
  document.getElementById('contractInformation').innerHTML = message;
}

function processAction(clickedId){
  // Check if an Ethereum node is found.
  if(web3.isConnected()){
    clearOutputs();

    let fromAddress = 0;
    let contractNumber = 0;
    let hashFile = 0;
    let signeesArray = [];
    let validationError = "";
    let newAddress = 0;

    if(document.getElementById('fromAddress')){
      fromAddress = document.getElementById('fromAddress').value;

      if(!web3.isAddress(fromAddress)){
        validationError += "Not a valid from address.\n";
      }
    }

    if(document.getElementById('contractNumber')){
      contractNumber = document.getElementById('contractNumber').value;

      if(!isContractNumberValid(contractNumber)){
        validationError += "Not a valid contract number.\n";
      }
    }

    if(document.getElementById('hashFile')){
      hashFile = document.getElementById('hashFile').value;

      if(hashFile != null) {
        hashFile = hashFile.trim();
      }
      if(!isHashValid(hashFile)){
        validationError += "Not a valid document hash.\n";
      }
    }

    if(document.getElementById('signees')){
      const signees = document.getElementById('signees').value;

      if(signees.trim().length != 0) {
        const signeesTempArray = signees.split('\n');
        signeesArray = signeesTempArray.map(str => str.trim());
      }

      if(signeesArray.length == 0) {
        validationError += "Need at least one signee address.\n";
      } else {
        // Check if each signee address is valid
        for(let i=0; i<signeesArray.length; i++){
          if(!web3.isAddress(signeesArray[i])){
            validationError += "Not a valid signee address: "+signeesArray[i]+".\n";
          }
        }
      }
    }

    if(document.getElementById('signContractNumber')){
      contractNumber = document.getElementById('signContractNumber').value;
      if(!isContractNumberValid(contractNumber)){
        validationError += "Not a valid contract number.\n";
      }
    }

	if(document.getElementById('newAddress')){
      newAddress = document.getElementById('newAddress').value;
	  if(!web3.isAddress(newAddress)){
        validationError += "Not a valid new ownership address.\n";
      }
    }

    if(validationError != ""){
      showResultMessage(validationError);
      return;
    }

    // Check if fromAddress is valid, if so continue.
    checkAddressPromise(fromAddress, "from account")
    .then(function(){

      if(clickedId == "addContractBtn"){
        addContract(fromAddress, contractNumber, hashFile);
      } else if(clickedId == "addSigneesBtn"){
        addSignees(fromAddress, contractNumber, signeesArray);
      } else if(clickedId == "deleteContractBtn"){
        deleteContract(fromAddress, contractNumber);
      } else if(clickedId == "signContractBtn"){
        signContract(fromAddress, contractNumber);
      } else if(clickedId == "showContractInformationBtn"){
        showContractInformation(fromAddress, contractNumber);
      } else if(clickedId == "transferOwnershipBtn"){
        transferOwnership(fromAddress, newAddress);
      } else if(clickedId == "uploadDataToSwarmBtn"){
        uploadDataToSwarm(fromAddress);
      } else if(clickedId == "downloadDataFromSwarmBtn"){
        downloadDataFromSwarm();
      }

    }).catch(function(message){
      const errorMessage = "Not a valid "+message+".";
      showResultMessage(errorMessage);
    });

  } else {
    showIntervalMessage("No Ethereum node found");
  }
}

function getContractState(stateIndex){
  const contractState = ["None", "Created", "Activated", "Completed"];
  return contractState[stateIndex];
}

function getSignState(signStateIndex){
  const signState = ["None", "Unsigned", "Signed"];
  return signState[signStateIndex];
}

function showEventInfo(result, action){
  let output = "";
  const amount = result.args.amount;
  const balance = result.args.balance;

  output += "Amount "+action+" = "+web3.fromWei(amount, 'ether')+" (ether),  New balance = "+web3.fromWei(balance, 'ether')+" (ether) \n\n";
  output += "Event result: Address from which this log originated = "+result.address+"\n";
  output += "Event result: Hash of the block where this log was in = "+result.blockHash+"\n";
  output += "Event result: The block number where this log was in was in = "+result.blockNumber+"\n";
  output += "Event result: Log index position in the block = "+result.logIndex+"\n";
  output += "Event result: The event name = "+result.event+"\n";
  output += "Event result: Is the transaction this event was created from was removed from the blockchain = "+result.removed+"\n";
  output += "Event result: The transactions index position log was created from = "+result.transactionIndex+"\n";
  output += "Event result: The hash of the transactions this log was created from = "+result.transactionHash+"\n";

  return output;
}

function displayActionContent(){
  clearOutputs();

  const actionType = document.getElementById('actionType').value;

  if(actionType == "addContract"){
    createAddContractContent();
  } else if(actionType == "addSignees"){
    createAddSigneesContractNumbersSelection();
  } else if(actionType == "deleteContract"){
    createDeleteContractNumbersSelection();
  } else if(actionType == "signContract"){
    createSignContractContractNumbersSelection();
  } else if(actionType == "showContractInformation"){
    createShowContractInformationContractNumbersSelection();
  } else if(actionType == "transferOwnership"){
    createTransferOwnershipCurrentAddress();
  } else if(actionType == "uploadDataToSwarm"){
    createUploadDataToSwarmContent();
  } else if(actionType == "DownloadDataFromSwarm"){
    createDownloadDataFromSwarmContent();
  }
}

function createAddContractContent() {
  let output = "";
  output += "<h2>Add contract<"+"/h2>";
  output += "<br />";
  output += "Contract number:<br />";
  output += "<input id='contractNumber' placeholder='value' >";
  output += "<br /><br />";
  output += "Document hash (sha-256):<br />";
  output += "<input id='hashFile' placeholder='hash' >";
  output += "<br /><br />";
  output += "Select and upload a file or drag-and-drop a file to calculate its sha-256 hash:<br />";
  output += "<input type='file' id='fileUpload'/> or ";
  output += "<div id='dropZone'>Drop file here<"+"/div>";
  output += "<output id='fileDrop'><"+"/output>";
  output += "<br /><br />";
  output += "<button id='addContractBtn'>Add contract<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createUploadDataToSwarmContent() {
  let output = "";
  output += "<h2>Upload data to Swarm</h2>";
  output += "<br />";
  output += "<label id='labBPM'> BPM </label> <input type='text' id='txtBPM'>";
  output += "<label id='labPulse'> Pulse </label> <input type='text' id='txtPulse'>";
  output += "<label id='labSPO2'> SPO2 </label> <input type='text' id='txtSPO2'>";
  output += "<button id='uploadDataToSwarmBtn'>Upload data to Swarm<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createDownloadDataFromSwarmContent() {
  let output = "";
  output += "<h2>Download data from Swarm</h2>";
  output += "<br />";
  output += "<button id='downloadDataFromSwarmBtn'>Download data from Swarm<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createAddSigneesContent(contractNumbers, statesArray) {
  let output = "";
  output += "<h2>Add signees<"+"/h2>";
  output += "<br />";
  output += "Select contract number to assign signees to:<br />";
  output += "<select id='contractNumber'>";
  // Created = 1
  for(let j=0; j<statesArray.length; j++) {
    if(statesArray[j] == 1) {
      output += "<option value='"+contractNumbers[j]+"'>"+contractNumbers[j]+"<"+"/option>";
    }
  }
  output += "<"+"/select>";

  output += "<br /><br />";
  output += "Signee Addresses (each on a separate line):<br />";
  output += "<textarea id='signees' rows='10' cols='80' placeholder='0x..'><"+"/textarea>";
  output += "<br /><br />";
  output += "<button id='addSigneesBtn'>Add signees<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createDeleteContractContent(contractNumbers, statesArray) {
  let output = "";
  output += "<h2>Delete contract<"+"/h2>";
  output += "<br />";
  output += "Select contract number to be deleted:<br />";
  output += "<select id='contractNumber'>";
  // None = 0, Created = 1
  for(let j=0; j<statesArray.length; j++) {
    if(statesArray[j] == 0 || statesArray[j] == 1) {
      output += "<option value='"+contractNumbers[j]+"'>"+contractNumbers[j]+"<"+"/option>";
    }
  }
  output += "<"+"/select>";

  output += "<br /><br />";
  output += "<button id='deleteContractBtn'>Delete contract<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createSignContractContent(contractNumbers, statesArray) {
  let output = "";
  output += "<h2>Sign contract<"+"/h2>";
  output += "<br />";
  output += "Select contract number to be signed:<br />";
  output += "<select id='signContractNumber'>";
  // Activated = 2
  for(let j=0; j<statesArray.length; j++) {
    if(statesArray[j] == 2) {
      output += "<option value='"+contractNumbers[j]+"'>"+contractNumbers[j]+"<"+"/option>";
    }
  }
  output += "<"+"/select>";
  output += "<br /><br />";
  output += "<button id='signContractBtn'>Sign contract<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createShowContractInformationContent(contractNumbers) {
  let output = "";
  output += "<h2>Show contract information<"+"/h2>";
  output += "<br />";
  output += "Select contract number to show all its information:<br />";
  output += "<select id='contractNumber'>";
  for(let i=0; i<contractNumbers.length; i++) {
    output += "<option value='"+contractNumbers[i]+"'>"+contractNumbers[i]+"<"+"/option>";
  }
  output += "<"+"/select>";
  output += "<br /><br />";
  output += "<button id='showContractInformationBtn'>Show information<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function createTransferOwnershipContent(ownerAddress) {
  let output = "";
  output += "<h2>Transfer ownership<"+"/h2>";
  output += "<br />";
  output += "Current owner address:<br />";
  output += ownerAddress+"<br />";
  output += "<br />";
  output += "Enter new address:<br />";
  output += "<input id='newAddress' placeholder='0x..' >";
  output += "<br /><br />";
  output += "<button id='transferOwnershipBtn'>Transfer ownership<"+"/button>";
  document.getElementById('actionContent').innerHTML = output;
}

function showHelp(){
  console.log("inside showHelp");
  let styleDisplay = document.getElementById('info').style.display;
  if(styleDisplay == "none") {
    document.getElementById('info').style.display = "inline";
  } else {
    document.getElementById('info').style.display = "none";
  }
}

// ===================================================
// Calling SignatureStorage.sol functions
// ===================================================
function getAllContractNumbers(){
  getAllContractNumbersPromise().then(function(contractNumbers){
    createSignContractContent(contractNumbers);
  }).catch(function(err){
    const message = debug ? ("getAllContractNumbers: "+err) : err;
    //alert(message);
    showResultMessage(message);
  });
}

const getContractStateAndCreateContent = function(contractNumbers, callback) {
  let promises = []; // Create an empty array which will hold getContractStatePromise
  for(let i = 0; i < contractNumbers.length; i++) {
    let contractNumber = contractNumbers[i].toString(10);
    const promise = getContractStatePromise(contractNumber);
  	promises.push(promise);
  }

  // Process the promises array
  Promise.all(promises).then(function(statesArray) {
    callback(contractNumbers, statesArray);
  }).catch(function(err) {
    const message = debug ? ("getContractStateAndCreateContent: "+err) : err;
    //alert(message);
    showResultMessage(message);
  });
}

function createTransferOwnershipCurrentAddress(){
  getOwnerAddressPromise().then(function(ownerAddress){
    createTransferOwnershipContent(ownerAddress);
  }).catch(function(err){
    const message = debug ? ("createTransferOwnershipCurrentAddress: "+err) : err;
    showResultMessage(message);
  });
}

function createDeleteContractNumbersSelection(){
  getAllContractNumbersPromise().then(function(contractNumbers){
    getContractStateAndCreateContent(contractNumbers, createDeleteContractContent);
  }).catch(function(err){
    const message = debug ? ("createDeleteContractNumbersSelection: "+err) : err;
    showResultMessage(message);
  });
}

function createAddSigneesContractNumbersSelection(){
  getAllContractNumbersPromise().then(function(contractNumbers){
    getContractStateAndCreateContent(contractNumbers, createAddSigneesContent);
  }).catch(function(err){
    const message = debug ? ("createAddSigneesContractNumbersSelection: "+err) : err;
    showResultMessage(message);
  });
}

function createSignContractContractNumbersSelection(){
  getAllContractNumbersPromise().then(function(contractNumbers){
    getContractStateAndCreateContent(contractNumbers, createSignContractContent);
  }).catch(function(err){
    const message = debug ? ("createSignContractContractNumbersSelection: "+err) : err;
    showResultMessage(message);
  });
}

function createShowContractInformationContractNumbersSelection(){
  getAllContractNumbersPromise().then(function(contractNumbers){
    getContractStateAndCreateContent(contractNumbers, createShowContractInformationContent);
  }).catch(function(err){
    const message = debug ? ("createShowContractInformationContractNumbersSelection: "+err) : err;
    showResultMessage(message);
  });
}

function transferOwnership(fromAddress, newAddress){
  getOwnerAddressPromise().then(function(ownerAddress){
    if(fromAddress != ownerAddress) {
      return Promise.reject("You are not the contract owner.");
    } else if(newAddress == ownerAddress) {
        return Promise.reject("You already are the contract owner.");
    } else {
      return Promise.resolve();
    }
  }).then(function(){
    return transferOwnershipPromise(fromAddress, newAddress)
  }).then(function(txhash){
    return getTransactionReceiptPromise(txhash)
  }).then(function(receipt){
    // This is a way to detect out-of-gas exception.
    // There must be a better solution!
    // This a temp solution, maybe there is a better way in web3.js v1.0.0??
    // https://github.com/MikeMcl/bignumber.js/
    const txGasUsed = web3.toBigNumber(receipt.gasUsed);
    const blockGasLimit = web3.toBigNumber("4476768");
    const halveBlockGasLimit = blockGasLimit.dividedBy(2);

    // My transaction gas usage can never be more than halve of the block gas limit!
    if(txGasUsed.greaterThan(halveBlockGasLimit)){
      document.getElementById('log').innerText = "Transfer ownership failed.";
    } else {
      //document.getElementById('log').innerText = "Transaction receipt object: \n"+JSON.stringify(receipt, null, "\t");
      document.getElementById('log').innerText = "Transfer ownership transaction is mined and included in block number: "+receipt.blockNumber+". Transaction hash: "+receipt.transactionHash;

      // Update owner address displayed on screen
      createTransferOwnershipContent(newAddress);
	}

  }).catch(function(err){
    const message = debug ? ("transferOwnership: "+err) : err;
    showResultMessage(message);
  });
}

function addContract(fromAddress, contractNumber, hashFile) {
  getOwnerAddressPromise().then(function(ownerAddress){
    if(fromAddress != ownerAddress) {
      return Promise.reject("You are not the contract owner.");
    } else {
      return Promise.resolve();
    }
  }).then(function(){
    return getContractStatePromise(contractNumber)
  }).then(function(contractStateIndex){
    if(contractStateIndex > 0) {
      return Promise.reject("Contract number already exists.");
    } else {
      return Promise.resolve();
    }
  }).then(function(){
    return addContractPromise(fromAddress, contractNumber, hashFile)
  }).then(function(txhash){
    return getTransactionReceiptPromise(txhash)
  }).then(function(receipt){
    // This is a way to detect out-of-gas exception.
    // There must be a better solution!
    // This a temp solution, maybe there is a better way in web3.js v1.0.0??
    // https://github.com/MikeMcl/bignumber.js/
    const txGasUsed = web3.toBigNumber(receipt.gasUsed);
    const blockGasLimit = web3.toBigNumber("4476768");
    const halveBlockGasLimit = blockGasLimit.dividedBy(2);

    // My transaction gas usage can never be more than halve of the block gas limit!
    if(txGasUsed.greaterThan(halveBlockGasLimit)){
      document.getElementById('log').innerText = "Add contract failed.";
    } else {
      //document.getElementById('log').innerText = "Transaction receipt object: \n"+JSON.stringify(receipt, null, "\t");
      document.getElementById('log').innerText = "Add contract transaction is mined and included in block number: "+receipt.blockNumber+". Transaction hash: "+receipt.transactionHash;
    }

  }).catch(function(err){
    const message = debug ? ("addContract: "+err) : err;
    showResultMessage(message);
  });
}

function uploadDataToSwarm(fromAddress) {
  getOwnerAddressPromise().then(function(ownerAddress){
    if(fromAddress != ownerAddress) {
      return Promise.reject("You are not the contract owner. Cannot upload data to swarm");
    } else {
      return Promise.resolve();
    }
  }).then(function() {
  var data = "";
  data += "BPM:" + document.getElementById('txtBPM').value + ",,,,";
  data += "Pulse:" + document.getElementById('txtPulse').value + ",,,,";
  data += "SPO2:" + document.getElementById('txtSPO2').value + ",,,,";
  var commandToUploadToSwarm = 'curl -H "Content-Type: text/plain" --data-binary \"' + data + '\" http://localhost:8500/bzz:/';
  console.log("Command to upload to Swarm: " + commandToUploadToSwarm);
  Meteor.call('runCode',commandToUploadToSwarm, function (swarmUpErr, swarmUpRes) {
    if (swarmUpErr) {
      console.log("Err_UPLOAD NEW MEDICAL RECORDS TO SWARM" + swarmUpErr);
    }
    else {
      console.log("Uploaded to Swarm. Hash = " + swarmUpRes);


      //////////////Code start////////////////////////
      uploadDataToSwarmPromise(fromAddress, swarmUpRes.toString()).then(function(txhash){
        return getTransactionReceiptPromise(txhash)
      }).then(function(receipt){
        const txGasUsed = web3.toBigNumber(receipt.gasUsed);
        const blockGasLimit = web3.toBigNumber("4476768");
        const halveBlockGasLimit = blockGasLimit.dividedBy(2);
        if(txGasUsed.greaterThan(halveBlockGasLimit)){
          document.getElementById('log').innerText = "Add contract failed.";
        } else {
          document.getElementById('log').innerText = "Add contract transaction is mined and included in block number: "+receipt.blockNumber+". Transaction hash: "+receipt.transactionHash;
        }
      }).catch(function(err){const message = debug ? ("uploadDataToSwarm: "+err) : err; showResultMessage(message);});
      /////////////Code end///////////////////////////



    }
  });
}).catch(function(err){
  const message = debug ? ("uploadDataToSwarm1: "+err) : err;
  showResultMessage(message);
});
}



function downloadDataFromSwarm() {
  console.log("inside downloadDataFromSwarm");
  var commandToDownloadFromSwarm = 'curl http://localhost:8500/bzz:/';
  console.log("Command to Download to Swarm: " + commandToDownloadFromSwarm);
  Meteor.call('runCode',commandToDownloadFromSwarm, function (swarmDownErr, swarmDownRes) {
          if (swarmDownErr) {
              console.log("Err_DOWNLOAD NEW MEDICAL RECORDS From SWARM" + swarmDownErr);
          }
          else {
            console.log("Downloaded from Swarm. Data = " + swarmDownRes);
          }
  });
}

function addSignees(fromAddress, contractNumber, accountAddresses) {
  getOwnerAddressPromise().then(function(ownerAddress){
    if(fromAddress != ownerAddress) {
      return Promise.reject("You are not the contract owner.");
    } else {
      return Promise.resolve();
    }
  }).then(function(){
    return getContractStatePromise(contractNumber)
  }).then(function(contractStateIndex){
    if(contractStateIndex == 1) {
      return Promise.resolve();
    } else {
      return Promise.reject("You can not assign signees when contract state is: "+getContractState(contractStateIndex));
    }

  }).then(function(){
    return addSigneesPromise(fromAddress, contractNumber, accountAddresses)
  }).then(function(txhash){
    return getTransactionReceiptPromise(txhash)
  }).then(function(receipt){
    // This is a way to detect out-of-gas exception.
    // There must be a better solution!
    // This a temp solution, maybe there is a better way in web3.js v1.0.0??
    // https://github.com/MikeMcl/bignumber.js/
    const txGasUsed = web3.toBigNumber(receipt.gasUsed);
    const blockGasLimit = web3.toBigNumber("4476768");
    const halveBlockGasLimit = blockGasLimit.dividedBy(2);

    // My transaction gas usage can never be more than halve of the block gas limit!
    if(txGasUsed.greaterThan(halveBlockGasLimit)){
      document.getElementById('log').innerText = "Add signees failed.";
    } else {
      //document.getElementById('log').innerText = "Transaction receipt object: \n"+JSON.stringify(receipt, null, "\t");
      document.getElementById('log').innerText = "Add signees transaction is mined and included in block number: "+receipt.blockNumber+". Transaction hash: "+receipt.transactionHash;

      // Update the selection box
      createAddSigneesContractNumbersSelection();
    }

  }).catch(function(err){
    const message = debug ? ("addSignees: "+err) : err;
    showResultMessage(message);
  });
}

function deleteContract(fromAddress, contractNumber) {
  getOwnerAddressPromise().then(function(ownerAddress){
    if(fromAddress != ownerAddress) {
      return Promise.reject("You are not the contract owner.");
    } else {
      return Promise.resolve();
    }
  }).then(function(){
    return deleteContractPromise(fromAddress, contractNumber)
  }).then(function(txhash){
    return getTransactionReceiptPromise(txhash)
  }).then(function(receipt){
    // This is a way to detect out-of-gas exception.
    // There must be a better solution!
    // This a temp solution, maybe there is a better way in web3.js v1.0.0??
    // https://github.com/MikeMcl/bignumber.js/
    const txGasUsed = web3.toBigNumber(receipt.gasUsed);
    const blockGasLimit = web3.toBigNumber("4476768");
    const halveBlockGasLimit = blockGasLimit.dividedBy(2);

    // My transaction gas usage can never be more than halve of the block gas limit!
    if(txGasUsed.greaterThan(halveBlockGasLimit)){
      document.getElementById('log').innerText = "Delete contract failed.";
    } else {
      //document.getElementById('log').innerText = "Transaction receipt object: \n"+JSON.stringify(receipt, null, "\t");
      document.getElementById('log').innerText = "Delete contract transaction is mined and included in block number: "+receipt.blockNumber+". Transaction hash: "+receipt.transactionHash;

      // Update the selection box
      createDeleteContractNumbersSelection();
    }
  }).catch(function(err){
    const message = debug ? ("deleteContract: "+err) : err;
    showResultMessage(message);
  });
}

function signContract(fromAddress, contractNumber) {
  getContractStatePromise(contractNumber).then(function(contractStateIndex){
    if(contractStateIndex == 2) {
      return Promise.resolve();
    } else {
      return Promise.reject("You can not sign this contract when contract state is: "+getContractState(contractStateIndex));
    }
  }).then(function(){
    return getAllSigneeAddressesPromise(contractNumber)
  }).then(function(addresses){
    if(addresses.includes(fromAddress)){
      return Promise.resolve();
    } else {
      return Promise.reject("The address "+fromAddress+" can not sign this contract.");
    }

  }).then(function(){
    return getSigneeStatusPromise(contractNumber, fromAddress)
  }).then(function(signState){
    if(signState == 1){
      // Unsigned
      return Promise.resolve();
    } else {
      return Promise.reject("You already have signed this contract.");
    }
  }).then(function(){
    return signContractPromise(fromAddress, contractNumber)
  }).then(function(txhash){
    return getTransactionReceiptPromise(txhash)
  }).then(function(receipt){
    // This is a way to detect out-of-gas exception.
    // There must be a better solution!
    // This a temp solution, maybe there is a better way in web3.js v1.0.0??
    // https://github.com/MikeMcl/bignumber.js/
    const txGasUsed = web3.toBigNumber(receipt.gasUsed);
    const blockGasLimit = web3.toBigNumber("4476768");
    const halveBlockGasLimit = blockGasLimit.dividedBy(2);

    // My transaction gas usage can never be more than halve of the block gas limit!
    if(txGasUsed.greaterThan(halveBlockGasLimit)){
      document.getElementById('log').innerText = "Sign contract failed.";
    } else {
      //document.getElementById('log').innerText = "Transaction receipt object: \n"+JSON.stringify(receipt, null, "\t");
      document.getElementById('log').innerText = "Sign contract transaction is mined and included in block number: "+receipt.blockNumber+". Transaction hash: "+receipt.transactionHash;

      // Update the selection box
      createSignContractContractNumbersSelection();
    }

  }).catch(function(err){
    const message = debug ? ("signContract: "+err) : err;
    showResultMessage(message);
  });
}

function showContractInformation(fromAddress, contractNumber) {
  let output = "Contract Information\n <br />";
  let signeeAddresses;

  getOwnerAddressPromise().then(function(ownerAddress){
    output += "Contract owner: "+ownerAddress+"\n <br />";
    return getDocumentHashPromise(contractNumber)
  }).then(function(hashFile){
    const hashPart1 = hashFile.substring(0,33);
    const hashPart2 = hashFile.substring(33);
    output += "Document hash:\n <br />";
    output += hashPart1+"\n <br />";
    output += hashPart2+"\n <br />";
    return getContractStatePromise(contractNumber)
  }).then(function(contractStateIndex){
    output += "Contract number: "+contractNumber+"\n <br />";
    output += "Contract status: "+getContractState(contractStateIndex)+"\n <br />";
    if(getContractState(contractStateIndex) == "Created"){
      document.getElementById('txtSwarmHash').value= "Add signees to share data";
    }
    else if(getContractState(contractStateIndex) == "Activated"){
      document.getElementById('txtSwarmHash').value= "Data will be displayed only after all parties signd";
    }
    else if(getContractState(contractStateIndex) == "Completed"){
      //output = "gotHash" + output + "Data location: " + "DataPlaceHolder"  + "\n <br />";
      getSwarmLocation();
    }    
    return getAllSigneeAddressesPromise(contractNumber)
  }).then(function(addresses){
    signeeAddresses = addresses;

    let promises = []; // Create an empty array which will hold getSigneeStatusPromise
    for(let i = 0; i < addresses.length; i++) {
      let address = addresses[i];
      const promise = getSigneeStatusPromise(contractNumber, address)
    	promises.push(promise);
    }

    return Promise.all(promises)

  }).then(function(statusArray) {
    if(statusArray.length == 0) {
      output += "The contract has no signees.\n";
    } else {
      for(let i=0; i<statusArray.length; i++) {
        let signStateIndex = statusArray[i];
        output += signeeAddresses[i] + ": " +getSignState(signStateIndex)+"\n";
      }
    }

    output += "\n\n";
    showContractInformationMessage(output);
  }).catch(function(err){
    const message = debug ? ("signContract: "+err) : err;
    showResultMessage(message);
  });
}

//}); Template.dapp.helper end

Template.dapp.onCreated(function helloOnCreated() {
  // counter starts at 0
  this.counter = new ReactiveVar(0);
});

//Template.dapp.helpers({
//  counter() {
//    return Template.instance().counter.get();
//  },
//});

Template.dapp.events({
  'click button'(event, instance) {
    // increment the counter when button is clicked
    instance.counter.set(instance.counter.get() + 1);
  },

  'click #helpLink'(event, instance) {
    showHelp();
  },

  'change #actionType'(event, instance) {
    displayActionContent();
  },

  'change #fileUpload'(event, instance) {
    handleFileSelect(event);
  },

  'click #addContractBtn'(event, instance) {
    processAction("addContractBtn");
  },

  'click #addSigneesBtn'(event, instance) {
    processAction("addSigneesBtn");
  },

  'click #deleteContractBtn'(event, instance) {
    processAction("deleteContractBtn");
  },

  'click #signContractBtn'(event, instance) {
    processAction("signContractBtn");
  },

  'click #showContractInformationBtn'(event, instance) {
    processAction("showContractInformationBtn");
  },

  'click #transferOwnershipBtn'(event, instance) {
    processAction("transferOwnershipBtn");
  },

  'click #uploadDataToSwarmBtn'(event, instance) {
    processAction("uploadDataToSwarmBtn");
  },
 
  'click #downloadDataFromSwarmBtn'(event, instance) {
    processAction("downloadDataFromSwarmBtn");
  },
  
  'click #btnGetData'(event, instance) {
    console.log("inside btnGetData. call the runCode callback here");
    var commandToDownloadFromSwarm = "curl http://localhost:8500/bzz:/" + document.getElementById('txtSwarmHash').value.toString() + "/";
    console.log("Command to download from Swarm: " + commandToDownloadFromSwarm);
    Meteor.call('runCode',commandToDownloadFromSwarm, function (swarmDownErr, swarmDownRes) {
      if(swarmDownRes) {
        console.log("swarmDownRes = " + swarmDownRes);
        document.getElementById('textAreaData').value = swarmDownRes;
      } else {
        console.log("Err = " + swarmDownErr);
      }
    })
  }


});







Template.hello.onCreated(function helloOnCreated() {
  // counter starts at 0
  this.counter = new ReactiveVar(0);
});

Template.hello.helpers({
  counter() {
    return Template.instance().counter.get();
  },
});

Template.hello.events({
  'click button'(event, instance) {
    // increment the counter when button is clicked
    instance.counter.set(instance.counter.get() + 1);
  },
});
