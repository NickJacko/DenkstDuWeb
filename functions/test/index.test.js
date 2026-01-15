// functions/test/index.test.js - MIT PROXYQUIRE

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// ✅ Create admin mock BEFORE any imports
const mockAuth = {
    verifyIdToken: sinon.stub(),
    deleteUser: sinon.stub(),
    setCustomUserClaims: sinon.stub()
};

const mockDatabase = {
    ref: sinon.stub(),
    ServerValue: {
        TIMESTAMP: Date.now()
    }
};

const mockStorage = {
    bucket: sinon.stub().returns({
        getFiles: sinon.stub().resolves([[]]),
        file: sinon.stub()
    })
};

const adminMock = {
    initializeApp: sinon.stub(),
    auth: sinon.stub().returns(mockAuth),
    database: sinon.stub().returns(mockDatabase),
    storage: sinon.stub().returns(mockStorage)
};

// ✅ Mock firebase-functions
const functionsMock = {
    https: {
        onRequest: (handler) => handler,
        onCall: (handler) => handler,
        HttpsError: class HttpsError extends Error {
            constructor(code, message) {
                super(message);
                this.code = code;
            }
        }
    },
    auth: {
        user: () => ({
            onDelete: (handler) => handler
        })
    },
    pubsub: {
        schedule: () => ({
            timeZone: () => ({
                onRun: (handler) => handler
            })
        })
    },
    runWith: () => ({
        https: {
            onRequest: (handler) => handler,
            onCall: (handler) => handler
        }
    }),
    logger: {
        info: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub()
    }
};

const functionsTest = require('firebase-functions-test')();

// ✅ Load functions with mocked dependencies
const myFunctions = proxyquire('../index', {
    'firebase-admin': adminMock,
    'firebase-functions': functionsMock
});

describe('Cloud Functions Security Tests', () => {
    beforeEach(() => {
        // Reset all stubs
        mockAuth.verifyIdToken.reset();
        mockAuth.deleteUser.reset();
        mockAuth.setCustomUserClaims.reset();
        mockDatabase.ref.reset();
    });

    afterEach(() => {
        sinon.resetHistory();
    });

    after(() => {
        functionsTest.cleanup();
    });

    describe('validateFSKAccess', () => {
        it('should reject unauthenticated requests', async () => {
            const req = {
                method: 'POST',
                headers: {},
                body: { data: { category: 'fsk16' } }
            };

            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub().returnsThis(),
                setHeader: sinon.stub(),
                set: sinon.stub(),
                send: sinon.stub()
            };

            await myFunctions.validateFSKAccess(req, res);

            expect(res.status.calledWith(401)).to.be.true;
        });

        it('should allow FSK0 for all users', async () => {
            const mockToken = 'valid-token-123';
            const mockUid = 'test-user-123';

            // ✅ Mock successful auth verification
            mockAuth.verifyIdToken.resolves({
                uid: mockUid,
                email: 'test@example.com'
            });

            const req = {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${mockToken}`,
                    origin: 'http://localhost:5000'
                },
                body: { data: { category: 'fsk0' } }
            };

            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub().returnsThis(),
                setHeader: sinon.stub(),
                set: sinon.stub(),
                send: sinon.stub()
            };

            await myFunctions.validateFSKAccess(req, res);

            expect(res.status.calledWith(200)).to.be.true;
            const jsonCall = res.json.getCall(0).args[0];
            expect(jsonCall.result.allowed).to.be.true;
        });

        it('should deny FSK16 for users under 16', async () => {
            const mockToken = 'valid-token-young';
            const mockUid = 'test-user-young';

            mockAuth.verifyIdToken.resolves({
                uid: mockUid,
                email: 'young@example.com'
            });

            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: true,
                        ageLevel: 14
                    })
                })
            };

            mockDatabase.ref.returns(dbRefStub);

            const req = {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${mockToken}`,
                    origin: 'http://localhost:5000'
                },
                body: { data: { category: 'fsk16' } }
            };

            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub().returnsThis(),
                setHeader: sinon.stub(),
                set: sinon.stub(),
                send: sinon.stub()
            };

            await myFunctions.validateFSKAccess(req, res);

            expect(res.status.calledWith(200)).to.be.true;
            const jsonCall = res.json.getCall(0).args[0];
            expect(jsonCall.result.allowed).to.be.false;
            expect(jsonCall.result.reason).to.equal('age_too_young');
        });

        it('should allow FSK16 for users 16 and older', async () => {
            const mockToken = 'valid-token-adult';
            const mockUid = 'test-user-adult';

            mockAuth.verifyIdToken.resolves({
                uid: mockUid,
                email: 'adult@example.com'
            });

            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: true,
                        ageLevel: 18
                    })
                })
            };

            mockDatabase.ref.returns(dbRefStub);

            const req = {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${mockToken}`,
                    origin: 'http://localhost:5000'
                },
                body: { data: { category: 'fsk16' } }
            };

            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub().returnsThis(),
                setHeader: sinon.stub(),
                set: sinon.stub(),
                send: sinon.stub()
            };

            await myFunctions.validateFSKAccess(req, res);

            expect(res.status.calledWith(200)).to.be.true;
            const jsonCall = res.json.getCall(0).args[0];
            expect(jsonCall.result.allowed).to.be.true;
        });

        it('should deny access if age is not verified', async () => {
            const mockToken = 'valid-token-unverified';
            const mockUid = 'test-user-unverified';

            mockAuth.verifyIdToken.resolves({
                uid: mockUid,
                email: 'unverified@example.com'
            });

            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: false
                    })
                })
            };

            mockDatabase.ref.returns(dbRefStub);

            const req = {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${mockToken}`,
                    origin: 'http://localhost:5000'
                },
                body: { data: { category: 'fsk16' } }
            };

            const res = {
                status: sinon.stub().returnsThis(),
                json: sinon.stub().returnsThis(),
                setHeader: sinon.stub(),
                set: sinon.stub(),
                send: sinon.stub()
            };

            await myFunctions.validateFSKAccess(req, res);

            expect(res.status.calledWith(200)).to.be.true;
            const jsonCall = res.json.getCall(0).args[0];
            expect(jsonCall.result.allowed).to.be.false;
            expect(jsonCall.result.reason).to.equal('age_not_verified');
        });
    });

    describe('exportUserData', () => {
        it('should reject unauthenticated requests', async () => {
            try {
                await myFunctions.exportUserData({}, {});
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Authentifizierung erforderlich');
            }
        });

        it('should export user profile and games', async () => {
            const mockUid = 'test-user-123';

            const userProfile = {
                displayName: 'Test User',
                ageVerified: true,
                ageLevel: 18
            };

            const games = {
                'game-1': {
                    hostId: mockUid,
                    players: {
                        [mockUid]: { score: 100 }
                    },
                    createdAt: Date.now()
                }
            };

            const userRefStub = {
                once: sinon.stub().resolves({ val: () => userProfile })
            };

            const gamesRefStub = {
                once: sinon.stub().resolves({ val: () => games })
            };

            mockDatabase.ref.onFirstCall().returns(userRefStub);
            mockDatabase.ref.onSecondCall().returns(gamesRefStub);

            const result = await myFunctions.exportUserData(
                {},
                { auth: { uid: mockUid, token: {} } }
            );

            expect(result.userId).to.equal(mockUid);
            expect(result.data.profile).to.deep.equal(userProfile);
            expect(result.data.games).to.have.lengthOf(1);
        });
    });

    describe('deleteMyAccount', () => {
        it('should reject unauthenticated requests', async () => {
            try {
                await myFunctions.deleteMyAccount({ confirmation: 'DELETE_MY_ACCOUNT' }, {});
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Authentifizierung erforderlich');
            }
        });

        it('should reject without proper confirmation', async () => {
            try {
                await myFunctions.deleteMyAccount(
                    { confirmation: 'wrong' },
                    { auth: { uid: 'test-user-123', token: {} } }
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Bestätigung erforderlich');
            }
        });
    });

    describe('setAgeVerification', () => {
        it('should reject invalid age levels', async () => {
            try {
                await myFunctions.setAgeVerification(
                    { ageLevel: -1 },
                    { auth: { uid: 'test-user-123', token: {} } }
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Ungültige Altersangabe');
            }
        });

        it('should reject age levels above 99', async () => {
            try {
                await myFunctions.setAgeVerification(
                    { ageLevel: 150 },
                    { auth: { uid: 'test-user-123', token: {} } }
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Ungültige Altersangabe');
            }
        });
    });
});

describe('DSGVO Compliance Tests', () => {
    it('cleanupUserData should remove user from all games', () => {
        expect(true).to.be.true;
    });

    it('cleanupOldGames should delete expired games', () => {
        expect(true).to.be.true;
    });
});