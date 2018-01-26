pragma solidity ^0.4.0;

/*
Signature Storage Dapp v0.1.0
Author: Robert Lie (mobilefish.com)
More information:
https://www.mobilefish.com/developer/blockchain/blockchain_quickguide_ethereum_tools.html

To interact with this contract use:
https://www.mobilefish.com/download/ethereum/SignatureStorage.html
*/

contract SignatureStorage {
  string public swarmAddress="aHash";
  function changeLocation(string _swarmAddress) onlyOwner {
      swarmAddress = _swarmAddress;
  }
  
  address public owner;

  enum SignState {None, Unsigned, Signed}
  enum ContractState {None, Created, Activated, Completed}

  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  struct ContractData {
    bytes32 hashFile;
    ContractState contractState;
    mapping(address => SignState) signees;
    address[] signeesIndex;
  }

  mapping(uint => ContractData) contracts;
  uint[] contractNumbers;

  function SignatureStorage() {
    owner = msg.sender;
  }

  function transferOwnership(address _newAddress) onlyOwner {
    owner = _newAddress;
  }

  function addContract(uint _contractNumber, bytes32 _hashFile) onlyOwner {
    require(_contractNumber > 0);
    require(_hashFile > 0);

    // The contract should not already exist
    require(contracts[_contractNumber].contractState == ContractState.None);

    ContractData memory contractData;
    contractData.hashFile = _hashFile;
    contractData.contractState = ContractState.Created;

    contracts[_contractNumber] = contractData;
    contractNumbers.push(_contractNumber);
  }

  // Once the signees are set, the contract state is activated.
  function addSignees(uint _contractNumber, address[] _accountAddresses) onlyOwner {
    require(_contractNumber > 0);
    require(_accountAddresses.length > 0);
    require(contracts[_contractNumber].contractState == ContractState.Created);
    require(contracts[_contractNumber].signeesIndex.length == 0);

    for (uint i=0; i<_accountAddresses.length; i++){
      contracts[_contractNumber].signees[_accountAddresses[i]] = SignState.Unsigned;
      contracts[_contractNumber].signeesIndex.push(_accountAddresses[i]);
    }

    contracts[_contractNumber].contractState = ContractState.Activated;
  }

  function updateContractNumbers(uint _contractNumber) private {
    uint index;
    bool foundNumber = false;

    // Find the index containing the _contractNumber
    for (uint i=0; i<contractNumbers.length; i++){
      if(contractNumbers[i] == _contractNumber) {
        index = i;
        foundNumber = true;
        break;
      }
    }

    // Cleanup the array. Make no gap.
    if (foundNumber) {
      for (uint j = index; j<contractNumbers.length-1; j++){
        contractNumbers[j] = contractNumbers[j+1];
      }
      delete contractNumbers[contractNumbers.length-1];
      contractNumbers.length--;
    }
  }

  function deleteContract(uint _contractNumber) onlyOwner {
    require(_contractNumber > 0);
    if(contracts[_contractNumber].contractState == ContractState.None || contracts[_contractNumber].contractState == ContractState.Created) {
      delete contracts[_contractNumber];
      updateContractNumbers(_contractNumber);
    }
  }

  function setContractCompletedIfAllSignaturesAreSet(uint _contractNumber) private {
    uint signedCounter = 0;
    uint numberOfSignees = contracts[_contractNumber].signeesIndex.length;

    for (uint i=0; i<numberOfSignees; i++){
      address signeeAddress = contracts[_contractNumber].signeesIndex[i];

      if(contracts[_contractNumber].signees[signeeAddress] == SignState.Signed) {
        signedCounter++;
      }
    }

    if(numberOfSignees == signedCounter) {
      contracts[_contractNumber].contractState = ContractState.Completed;
    }
  }

  function signContract(uint _contractNumber) {
    require(msg.sender != owner);
    require(_contractNumber > 0);
    require(contracts[_contractNumber].contractState == ContractState.Activated);

    if(contracts[_contractNumber].signees[msg.sender] == SignState.Unsigned) {
      contracts[_contractNumber].signees[msg.sender] = SignState.Signed;
      setContractCompletedIfAllSignaturesAreSet(_contractNumber);
    }
  }

  function getAllSigneeAddresses(uint _contractNumber) constant returns (address[]){
    require(_contractNumber > 0);
    require(contracts[_contractNumber].contractState != ContractState.None);
    require(contracts[_contractNumber].contractState != ContractState.Created);

    return contracts[_contractNumber].signeesIndex;
  }

  function getAllContractNumbers() constant returns (uint[]){
    return contractNumbers;
  }

  function getContractState(uint _contractNumber) constant returns (ContractState){
    return contracts[_contractNumber].contractState;
  }

  function getDocumentHash(uint _contractNumber) constant returns (bytes32){
    return contracts[_contractNumber].hashFile;
  }

  function getSigneeStatus(uint _contractNumber, address _signeeAddress) constant returns (SignState){
    require(_contractNumber > 0);
    require(contracts[_contractNumber].contractState != ContractState.None);
    require(contracts[_contractNumber].contractState != ContractState.Created);

    return contracts[_contractNumber].signees[_signeeAddress];
  }
}

