const helpers = require("./helpers");
const Controller = artifacts.require("./Controller.sol");
const BackDoor = artifacts.require("./BackDoor.sol");


class BackDoorParams {
  constructor() {
  }
}

var registration;
const setupBackDoor = async function(_avatarAddress,_owner) {
  var backDoorParams = new BackDoorParams();
  backDoorParams.initdata = await new web3.eth.Contract(registration.backDoor.abi)
                        .methods
                        .initialize(_avatarAddress,_owner)
                        .encodeABI();

  return backDoorParams;
};

const setup = async function (accounts) {
   var testSetup = new helpers.TestSetup();
   registration = await helpers.registerImplementation();
   testSetup.reputationArray = [2000,4000,7000];
   testSetup.proxyAdmin = accounts[5];
   testSetup.org = await helpers.setupOrganizationWithArraysDAOFactory(testSetup.proxyAdmin,
                                                                       accounts,
                                                                       registration,
                                                                       [accounts[0],
                                                                       accounts[1],
                                                                       accounts[2]],
                                                                       [1000,0,0],
                                                                       testSetup.reputationArray);
   testSetup.owner = accounts[4];
   testSetup.backDoorParams= await setupBackDoor(
                      testSetup.org.avatar.address,
                      testSetup.owner
                      );
   var permissions = "0x0000001f";

   var tx = await registration.daoFactory.setSchemes(
                           testSetup.org.avatar.address,
                           [web3.utils.fromAscii("BackDoor")],
                           testSetup.backDoorParams.initdata,
                           [helpers.getBytesLength(testSetup.backDoorParams.initdata)],
                           [permissions],
                           "metaData",{from:testSetup.proxyAdmin});

   testSetup.backDoor = await BackDoor.at(tx.logs[1].args._scheme);

   return testSetup;
};
contract('BackDoor', accounts => {

    it("register scheme", async function() {
       var testSetup = await setup(accounts);
       var controllerAddress =  await testSetup.org.avatar.owner();
       var controller =  await Controller.at(controllerAddress);
       assert.equal((await controller.schemesPermissions(accounts[3])), "0x00000000");
       try {
         await testSetup.backDoor.registerScheme(accounts[3]);
         assert(false, "only owner can register scheme");
       } catch(error) {
         helpers.assertVMException(error);
       }
       var tx = await testSetup.backDoor.registerScheme(accounts[3],{from:testSetup.owner});

       await controller.getPastEvents('RegisterScheme', {
             fromBlock: tx.blockNumber,
             toBlock: 'latest'
         })
         .then(function(events){
             assert.equal(events[0].event,"RegisterScheme");
             assert.equal(events[0].args._scheme,accounts[3]);
         });
       assert.equal((await controller.schemesPermissions(accounts[3])), "0x0000001f");

    });

});
